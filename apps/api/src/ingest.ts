import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { findLeadByPhone, firstStageId, getOrCreateConversation, tenantCountry } from "./crm-data.js";
import { decryptToken } from "./crypto.js";
import { withIngest, withTenant, type Database, type Transaction } from "./db.js";
import type { Deps } from "./deps.js";
import { MetaApiError, type MetaLeadField } from "./meta.js";
import { normalizePhone, phoneFromWhatsApp } from "./phone.js";
import { conversations, integrations, leadEvents, leads, messages, webhookEvents } from "./schema.js";

export const PROVIDER_LEADGEN = "meta_leadgen";
export const PROVIDER_WHATSAPP = "whatsapp";

type LeadgenPayload = {
  pageId: string;
  leadgenId: string;
  formId?: string;
  adId?: string;
  createdTime?: number;
};

type WhatsAppPayload =
  | {
      kind: "message";
      phoneNumberId: string;
      contactName?: string;
      message: WhatsAppInboundMessage;
    }
  | {
      kind: "status";
      phoneNumberId: string;
      status: { id: string; status: string; timestamp?: string; recipient_id?: string; errors?: Array<{ code?: number; title?: string; message?: string }> };
    };

type WhatsAppInboundMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  audio?: unknown;
  sticker?: unknown;
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

export type ExtractedEvent = { provider: string; externalId: string; payload: unknown };

// El evento "leadgen" solo trae el id del lead. Los datos se piden después a la Graph API.
export function extractLeadgenEvents(body: unknown): ExtractedEvent[] {
  const root = body as { object?: string; entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: Record<string, unknown> }> }> };
  if (root?.object !== "page") return [];
  const events: ExtractedEvent[] = [];
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const value = change.value ?? {};
      const leadgenId = typeof value.leadgen_id === "string" || typeof value.leadgen_id === "number" ? String(value.leadgen_id) : null;
      const pageId = String(value.page_id ?? entry.id ?? "");
      if (!leadgenId || !pageId) continue;
      const payload: LeadgenPayload = {
        pageId,
        leadgenId,
        formId: value.form_id !== undefined ? String(value.form_id) : undefined,
        adId: value.ad_id !== undefined ? String(value.ad_id) : undefined,
        createdTime: typeof value.created_time === "number" ? value.created_time : undefined,
      };
      events.push({ provider: PROVIDER_LEADGEN, externalId: leadgenId, payload });
    }
  }
  return events;
}

export function extractWhatsAppEvents(body: unknown): ExtractedEvent[] {
  const root = body as {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: WhatsAppInboundMessage[];
          statuses?: Array<{ id: string; status: string; timestamp?: string; recipient_id?: string; errors?: Array<{ code?: number; title?: string; message?: string }> }>;
        };
      }>;
    }>;
  };
  if (root?.object !== "whatsapp_business_account") return [];
  const events: ExtractedEvent[] = [];
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const phoneNumberId = change.value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      for (const message of change.value.messages ?? []) {
        if (!message?.id) continue;
        const contact = change.value.contacts?.find((item) => item.wa_id === message.from);
        const payload: WhatsAppPayload = { kind: "message", phoneNumberId, contactName: contact?.profile?.name, message };
        events.push({ provider: PROVIDER_WHATSAPP, externalId: message.id, payload });
      }
      for (const status of change.value.statuses ?? []) {
        if (!status?.id || !status.status) continue;
        const payload: WhatsAppPayload = { kind: "status", phoneNumberId, status };
        events.push({ provider: PROVIDER_WHATSAPP, externalId: `${status.id}:${status.status}`, payload });
      }
    }
  }
  return events;
}

// Guarda el evento sin agencia. Si ya existía (mismo proveedor e id) no hace nada.
export async function storeWebhookEvent(db: Database, event: ExtractedEvent): Promise<string | null> {
  return withIngest(db, {}, async (tx) => {
    const [row] = await tx
      .insert(webhookEvents)
      .values({ provider: event.provider, externalId: event.externalId, payload: event.payload as object })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    return row?.id ?? null;
  });
}

async function resolveIntegration(db: Database, provider: "meta_page" | "whatsapp", account: string) {
  return withIngest(db, { provider, account }, async (tx) => {
    const [row] = await tx
      .select()
      .from(integrations)
      .where(and(eq(integrations.provider, provider), eq(integrations.externalAccountId, account), eq(integrations.status, "active")))
      .limit(1);
    return row ?? null;
  });
}

async function markProcessed(tx: Transaction, id: string, tenantId: string | null) {
  await tx
    .update(webhookEvents)
    .set({ tenantId, processedAt: new Date() })
    .where(and(eq(webhookEvents.id, id), isNull(webhookEvents.processedAt)));
}

export async function processWebhookEvent(deps: Deps, webhookEventId: string, final: boolean): Promise<void> {
  const event = await withIngest(deps.db, {}, async (tx) => {
    const [row] = await tx.select().from(webhookEvents).where(eq(webhookEvents.id, webhookEventId)).limit(1);
    return row ?? null;
  });
  if (!event || event.processedAt) return;

  if (event.provider === PROVIDER_LEADGEN) {
    await processLeadgen(deps, event.id, event.payload as LeadgenPayload);
  } else if (event.provider === PROVIDER_WHATSAPP) {
    await processWhatsApp(deps, event.id, event.payload as WhatsAppPayload, final);
  } else {
    await withIngest(deps.db, {}, (tx) => markProcessed(tx, event.id, null));
  }
}

function fieldValue(fields: MetaLeadField[], ...names: string[]): string | undefined {
  const wanted = names.map((name) => name.toLowerCase());
  const field = fields.find((item) => wanted.includes(item.name.toLowerCase()));
  const value = field?.values?.[0];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function processLeadgen(deps: Deps, eventId: string, payload: LeadgenPayload) {
  const integration = await resolveIntegration(deps.db, "meta_page", payload.pageId);
  if (!integration) {
    // La página no está conectada (o se desconectó). No hay agencia a la que asignar el lead.
    await withIngest(deps.db, {}, (tx) => markProcessed(tx, eventId, null));
    return;
  }

  let metaLead;
  try {
    metaLead = await deps.meta.getLead(payload.leadgenId, decryptToken(integration.accessTokenEncrypted));
  } catch (error) {
    if (error instanceof MetaApiError && (error.status === 401 || error.code === 190)) {
      await withTenant(deps.db, integration.tenantId, (tx) =>
        tx.update(integrations).set({ status: "error" }).where(eq(integrations.id, integration.id)),
      );
    }
    // Si fallan todos los intentos, el evento queda sin procesar y el barrido
    // lo vuelve a encolar durante las siguientes 24 h.
    throw error;
  }

  const created = await withIngest(deps.db, { tenantId: integration.tenantId }, async (tx) => {
    const country = await tenantCountry(tx, integration.tenantId);
    const rawPhone = fieldValue(metaLead.fields, "phone_number", "phone");
    const phone = normalizePhone(rawPhone, country);
    const fullName =
      fieldValue(metaLead.fields, "full_name") ??
      [fieldValue(metaLead.fields, "first_name"), fieldValue(metaLead.fields, "last_name")].filter(Boolean).join(" ");
    const formAnswers: Record<string, string | string[]> = {};
    for (const field of metaLead.fields) {
      formAnswers[field.name] = field.values.length === 1 ? (field.values[0] as string) : field.values;
    }

    const [lead] = await tx
      .insert(leads)
      .values({
        tenantId: integration.tenantId,
        name: fullName || null,
        email: fieldValue(metaLead.fields, "email")?.toLowerCase() ?? null,
        phone,
        stageId: await firstStageId(tx, integration.tenantId),
        source: "meta_lead_ads",
        metaLeadId: payload.leadgenId,
        metaFormId: metaLead.formId ?? payload.formId ?? null,
        campaignId: metaLead.campaignId ?? null,
        adsetId: metaLead.adsetId ?? null,
        adId: metaLead.adId ?? payload.adId ?? null,
        formAnswers,
      })
      .onConflictDoNothing()
      .returning({ id: leads.id });

    if (lead) {
      await tx.insert(leadEvents).values({
        tenantId: integration.tenantId,
        leadId: lead.id,
        type: "lead_created",
        payload: {
          source: "meta_lead_ads",
          metaLeadId: payload.leadgenId,
          pageId: payload.pageId,
          phoneNormalized: phone !== null,
          ...(rawPhone && !phone ? { rawPhone } : {}),
        },
        occurredAt: metaLead.createdTime ? new Date(metaLead.createdTime) : new Date(),
      });
    }
    await markProcessed(tx, eventId, integration.tenantId);
    return lead?.id ?? null;
  });

  if (created) await deps.realtime.publish(integration.tenantId, { type: "lead", leadId: created });
}

const statusRank: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };

function inboundContent(message: WhatsAppInboundMessage): { type: "text" | "media"; content: string } {
  switch (message.type) {
    case "text":
      return { type: "text", content: message.text?.body ?? "" };
    case "image":
      return { type: "media", content: message.image?.caption ?? "[imagen]" };
    case "video":
      return { type: "media", content: message.video?.caption ?? "[vídeo]" };
    case "document":
      return { type: "media", content: message.document?.caption ?? message.document?.filename ?? "[documento]" };
    case "audio":
      return { type: "media", content: "[audio]" };
    case "sticker":
      return { type: "media", content: "[sticker]" };
    case "button":
      return { type: "text", content: message.button?.text ?? "[botón]" };
    case "interactive":
      return {
        type: "text",
        content: message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "[respuesta interactiva]",
      };
    default:
      return { type: "text", content: `[mensaje de tipo ${message.type}, sin soporte todavía]` };
  }
}

async function processWhatsApp(deps: Deps, eventId: string, payload: WhatsAppPayload, final: boolean) {
  const integration = await resolveIntegration(deps.db, "whatsapp", payload.phoneNumberId);
  if (!integration) {
    await withIngest(deps.db, {}, (tx) => markProcessed(tx, eventId, null));
    return;
  }
  const tenantId = integration.tenantId;

  if (payload.kind === "message") {
    const result = await withIngest(deps.db, { tenantId }, async (tx) => {
      const phone = phoneFromWhatsApp(payload.message.from);
      if (!phone) {
        await markProcessed(tx, eventId, tenantId);
        return null;
      }
      let lead = await findLeadByPhone(tx, tenantId, phone);
      let leadCreated = false;
      if (!lead) {
        const [inserted] = await tx
          .insert(leads)
          .values({
            tenantId,
            name: payload.contactName ?? null,
            phone,
            stageId: await firstStageId(tx, tenantId),
            source: "whatsapp",
          })
          .returning();
        lead = inserted ?? null;
        leadCreated = true;
        if (lead) {
          await tx.insert(leadEvents).values({ tenantId, leadId: lead.id, type: "lead_created", payload: { source: "whatsapp" } });
        }
      }
      if (!lead) throw new Error("No se pudo crear el lead");

      const conversation = await getOrCreateConversation(tx, tenantId, lead.id);
      const sentAt = payload.message.timestamp ? new Date(Number(payload.message.timestamp) * 1000) : new Date();
      const content = inboundContent(payload.message);

      const [message] = await tx
        .insert(messages)
        .values({
          tenantId,
          conversationId: conversation.id,
          direction: "in",
          senderType: "lead",
          type: content.type,
          content: content.content,
          externalId: payload.message.id,
          status: "delivered",
          createdAt: sentAt,
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });

      if (message) {
        await tx
          .update(conversations)
          .set({
            lastInboundAt: sql`GREATEST(COALESCE(${conversations.lastInboundAt}, ${sentAt.toISOString()}::timestamptz), ${sentAt.toISOString()}::timestamptz)`,
            lastMessageAt: sql`GREATEST(COALESCE(${conversations.lastMessageAt}, ${sentAt.toISOString()}::timestamptz), ${sentAt.toISOString()}::timestamptz)`,
          })
          .where(eq(conversations.id, conversation.id));
        await tx.insert(leadEvents).values({
          tenantId,
          leadId: lead.id,
          type: "message",
          payload: { direction: "in", messageId: message.id },
          occurredAt: sentAt,
        });
      }
      await markProcessed(tx, eventId, tenantId);
      return { conversationId: conversation.id, messageId: message?.id ?? null, leadId: lead.id, leadCreated };
    });

    if (result) {
      if (result.leadCreated) await deps.realtime.publish(tenantId, { type: "lead", leadId: result.leadId });
      if (result.messageId) {
        await deps.realtime.publish(tenantId, {
          type: "message",
          conversationId: result.conversationId,
          messageId: result.messageId,
          direction: "in",
        });
      }
    }
    return;
  }

  // Estados de entrega: sent, delivered, read o failed.
  const { status } = payload;
  const outcome = await withIngest(deps.db, { tenantId }, async (tx) => {
    const [message] = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.externalId, status.id)))
      .limit(1);
    if (!message) {
      // Puede que el estado llegue antes de que el worker de envío guarde el id. Se reintenta.
      if (!final) return "retry" as const;
      await markProcessed(tx, eventId, tenantId);
      return "ignored" as const;
    }
    let next: string | null = null;
    let error: string | null = null;
    if (status.status === "failed") {
      if (message.status !== "read") {
        next = "failed";
        const first = status.errors?.[0];
        error = first ? [first.code, first.title ?? first.message].filter(Boolean).join(" · ") : "Meta no pudo entregar el mensaje";
      }
    } else if (status.status in statusRank) {
      const current = statusRank[message.status];
      if (current !== undefined && (statusRank[status.status] as number) > current) next = status.status;
    }
    if (next) {
      await tx.update(messages).set({ status: next, error }).where(eq(messages.id, message.id));
    }
    await markProcessed(tx, eventId, tenantId);
    return { conversationId: message.conversationId, messageId: message.id, status: next } as const;
  });

  if (outcome === "retry") throw new Error("El mensaje todavía no tiene id externo");
  if (outcome !== "ignored" && outcome.status) {
    await deps.realtime.publish(tenantId, {
      type: "message_status",
      conversationId: outcome.conversationId,
      messageId: outcome.messageId,
      status: outcome.status,
    });
  }
}

// Reproceso: eventos guardados que no llegaron a procesarse (Redis caído, reinicio del servidor).
export async function sweepWebhookEvents(deps: Deps): Promise<number> {
  if (!deps.queue) return 0;
  const pending = await withIngest(deps.db, {}, async (tx) =>
    tx
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(
        and(
          isNull(webhookEvents.processedAt),
          lt(webhookEvents.createdAt, sql`now() - interval '2 minutes'`),
          gt(webhookEvents.createdAt, sql`now() - interval '24 hours'`),
        ),
      )
      .limit(200),
  );
  let queued = 0;
  for (const row of pending) {
    try {
      await deps.queue.enqueueWebhook(row.id);
      queued += 1;
    } catch {
      break;
    }
  }
  return queued;
}
