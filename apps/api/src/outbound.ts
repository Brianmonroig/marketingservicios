import { and, eq, sql } from "drizzle-orm";
import { HttpError } from "./accounts.js";
import { getOrCreateConversation } from "./crm-data.js";
import { decryptToken } from "./crypto.js";
import { withTenant } from "./db.js";
import type { Deps } from "./deps.js";
import { MetaApiError } from "./meta.js";
import { whatsappRecipient } from "./phone.js";
import type { SendJobData } from "./queues.js";
import { conversations, integrations, leadEvents, leads, messages, tenants } from "./schema.js";

export const WINDOW_MS = 24 * 60 * 60 * 1000;

export const WINDOW_CLOSED_MESSAGE =
  "La ventana de 24 h está cerrada. Solo puedes enviar una plantilla aprobada hasta que el lead vuelva a escribir.";

// La ventana de atención al cliente se abre con el último mensaje que escribe el lead.
export function isWindowOpen(lastInboundAt: Date | null | undefined, now = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() <= WINDOW_MS;
}

export type OutboundContent =
  | { type: "text"; text: string }
  | { type: "template"; name: string; language: string; params: string[] };

type Target = { conversationId: string } | { leadId: string };

// Valida las reglas, guarda el mensaje como "queued" y lo encola. No habla con Meta.
export async function queueOutboundMessage(
  deps: Deps,
  tenantId: string,
  target: Target,
  content: OutboundContent,
): Promise<{ messageId: string; conversationId: string }> {
  const created = await withTenant(deps.db, tenantId, async (tx) => {
    let leadId: string;
    if ("conversationId" in target) {
      const [conversation] = await tx
        .select({ leadId: conversations.leadId })
        .from(conversations)
        .where(and(eq(conversations.id, target.conversationId), eq(conversations.tenantId, tenantId)))
        .limit(1);
      if (!conversation) throw new HttpError("La conversación no existe", 404);
      leadId = conversation.leadId;
    } else {
      leadId = target.leadId;
    }

    const [lead] = await tx
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);
    if (!lead) throw new HttpError("El lead no existe", 404);
    if (!lead.phone) throw new HttpError("El lead no tiene un teléfono válido", 422, "no_phone");

    const [integration] = await tx
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "whatsapp"), eq(integrations.status, "active")))
      .limit(1);
    if (!integration) throw new HttpError("No hay un número de WhatsApp conectado", 409, "no_whatsapp");

    const conversation = await getOrCreateConversation(tx, tenantId, lead.id);

    if (content.type === "text") {
      if (!isWindowOpen(conversation.lastInboundAt)) {
        throw new HttpError(WINDOW_CLOSED_MESSAGE, 409, "window_closed");
      }
    } else if (!lead.whatsappOptIn) {
      throw new HttpError("El lead no ha dado permiso para recibir WhatsApp", 409, "no_opt_in");
    }

    const [message] = await tx
      .insert(messages)
      .values({
        tenantId,
        conversationId: conversation.id,
        direction: "out",
        senderType: "user",
        type: content.type,
        content:
          content.type === "text"
            ? content.text
            : `Plantilla «${content.name}»${content.params.length > 0 ? `: ${content.params.join(" · ")}` : ""}`,
        template: content.type === "template" ? { name: content.name, language: content.language, params: content.params } : null,
        status: "queued",
      })
      .returning({ id: messages.id });
    if (!message) throw new Error("No se pudo guardar el mensaje");

    await tx
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversation.id));
    await tx.insert(leadEvents).values({
      tenantId,
      leadId: lead.id,
      type: "message",
      payload: { direction: "out", messageId: message.id, kind: content.type },
    });

    return { messageId: message.id, conversationId: conversation.id };
  });

  await deps.realtime.publish(tenantId, {
    type: "message",
    conversationId: created.conversationId,
    messageId: created.messageId,
    direction: "out",
  });

  if (!deps.queue) {
    await markMessageFailed(deps, tenantId, created.messageId, created.conversationId, "La cola de envíos no está disponible");
    throw new HttpError("La cola de envíos no está disponible", 503);
  }
  try {
    await deps.queue.enqueueSend({ messageId: created.messageId, tenantId });
  } catch {
    await markMessageFailed(deps, tenantId, created.messageId, created.conversationId, "No se pudo encolar el envío");
    throw new HttpError("No se pudo encolar el envío", 503);
  }
  return created;
}

async function markMessageFailed(deps: Deps, tenantId: string, messageId: string, conversationId: string, error: string) {
  await withTenant(deps.db, tenantId, (tx) =>
    tx.update(messages).set({ status: "failed", error }).where(eq(messages.id, messageId)),
  );
  await deps.realtime.publish(tenantId, { type: "message_status", conversationId, messageId, status: "failed" });
}

// Handler de la cola de envíos.
export async function sendQueuedMessage(deps: Deps, data: SendJobData, final: boolean): Promise<void> {
  const prepared = await withTenant(deps.db, data.tenantId, async (tx) => {
    const [message] = await tx.select().from(messages).where(eq(messages.id, data.messageId)).limit(1);
    if (!message || message.status !== "queued") return null;
    const [conversation] = await tx.select().from(conversations).where(eq(conversations.id, message.conversationId)).limit(1);
    if (!conversation) return null;
    const [lead] = await tx.select().from(leads).where(eq(leads.id, conversation.leadId)).limit(1);
    const [integration] = await tx
      .select()
      .from(integrations)
      .where(and(eq(integrations.provider, "whatsapp"), eq(integrations.status, "active")))
      .limit(1);
    return { message, conversation, lead, integration };
  });
  if (!prepared) return;
  const { message, conversation, lead, integration } = prepared;

  const fail = (error: string) => markMessageFailed(deps, data.tenantId, message.id, conversation.id, error);

  if (!lead?.phone) return fail("El lead no tiene un teléfono válido");
  if (!integration) return fail("No hay un número de WhatsApp conectado");
  if (message.type === "text" && !isWindowOpen(conversation.lastInboundAt)) {
    return fail(WINDOW_CLOSED_MESSAGE);
  }

  let token: string;
  try {
    token = decryptToken(integration.accessTokenEncrypted);
  } catch {
    return fail("No se pudo leer el token de WhatsApp. Vuelve a conectar el número.");
  }

  try {
    const result = await deps.meta.sendWhatsApp(
      integration.externalAccountId,
      token,
      message.type === "template" && message.template
        ? {
            to: whatsappRecipient(lead.phone),
            type: "template",
            name: message.template.name,
            language: message.template.language,
            params: message.template.params,
          }
        : { to: whatsappRecipient(lead.phone), type: "text", text: message.content ?? "" },
    );
    await withTenant(deps.db, data.tenantId, async (tx) => {
      await tx
        .update(messages)
        .set({ status: sql`CASE WHEN ${messages.status} = 'queued' THEN 'sent' ELSE ${messages.status} END`, externalId: result.messageId })
        .where(eq(messages.id, message.id));
    });
    await deps.realtime.publish(data.tenantId, {
      type: "message_status",
      conversationId: conversation.id,
      messageId: message.id,
      status: "sent",
    });
  } catch (error) {
    const detail = error instanceof MetaApiError ? error.message : "Error desconocido al enviar";
    const retryable = error instanceof MetaApiError && error.retryable;
    if (retryable && !final) throw error;
    await fail(detail);
    if (error instanceof MetaApiError && error.status === 401) {
      await withTenant(deps.db, data.tenantId, (tx) =>
        tx.update(integrations).set({ status: "error" }).where(eq(integrations.id, integration.id)),
      );
    }
  }
}

// Primer contacto: un lead con permiso de WhatsApp recibe la plantilla elegida en los ajustes.
export async function maybeSendFirstContact(deps: Deps, tenantId: string, leadId: string): Promise<boolean> {
  const plan = await withTenant(deps.db, tenantId, async (tx) => {
    const [lead] = await tx.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead || !lead.whatsappOptIn || !lead.phone) return null;
    const [tenant] = await tx.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const template = (tenant?.settings as { firstContactTemplate?: { name: string; language: string; params?: string[] } } | undefined)
      ?.firstContactTemplate;
    if (!template) return null;
    const [conversation] = await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.leadId, leadId)).limit(1);
    if (conversation) {
      const [already] = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.conversationId, conversation.id), eq(messages.direction, "out")))
        .limit(1);
      if (already) return null;
    }
    return template;
  });
  if (!plan) return false;
  try {
    await queueOutboundMessage(deps, tenantId, { leadId }, {
      type: "template",
      name: plan.name,
      language: plan.language,
      params: plan.params ?? [],
    });
    return true;
  } catch (error) {
    if (error instanceof HttpError) return false;
    throw error;
  }
}
