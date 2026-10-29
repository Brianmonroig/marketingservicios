import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { createTemplateSchema, firstContactTemplateSchema, optInSchema, sendMessageSchema } from "@crm/shared";
import { HttpError } from "../accounts.js";
import { decryptToken } from "../crypto.js";
import { withTenant } from "../db.js";
import type { Deps } from "../deps.js";
import { requireManager, requireUser } from "../guard.js";
import { ensureContactFromLead } from "../crm-data.js";
import { isWindowOpen, maybeSendFirstContact, queueOutboundMessage } from "../outbound.js";
import { contacts, conversations, integrations, leadEvents, leads, messages, opportunities, pipelineStages, tenants } from "../schema.js";

async function whatsappAccount(deps: Deps, tenantId: string) {
  const row = await withTenant(deps.db, tenantId, async (tx) => {
    const [found] = await tx
      .select()
      .from(integrations)
      .where(and(eq(integrations.provider, "whatsapp"), eq(integrations.status, "active")))
      .limit(1);
    return found ?? null;
  });
  if (!row) throw new HttpError("No hay un número de WhatsApp conectado", 409, "no_whatsapp");
  const wabaId = (row.metadata as { wabaId?: string }).wabaId;
  if (!wabaId) throw new HttpError("Al número le falta el id de la cuenta de WhatsApp Business. Vuelve a conectarlo.", 409);
  return { wabaId, token: decryptToken(row.accessTokenEncrypted) };
}

export async function registerCrmRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/leads", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const { q } = request.query as { q?: string };
    const search = q?.trim();
    const rows = await withTenant(deps.db, user.tenantId, (tx) =>
      tx
        .select({
          id: leads.id,
          name: leads.name,
          email: leads.email,
          phone: leads.phone,
          source: leads.source,
          score: leads.score,
          whatsappOptIn: leads.whatsappOptIn,
          campaignId: leads.campaignId,
          createdAt: leads.createdAt,
          stageName: pipelineStages.name,
        })
        .from(leads)
        .leftJoin(pipelineStages, eq(pipelineStages.id, leads.stageId))
        .where(
          search
            ? and(
                eq(leads.tenantId, user.tenantId),
                or(ilike(leads.name, `%${search}%`), ilike(leads.phone, `%${search}%`), ilike(leads.email, `%${search}%`)),
              )
            : eq(leads.tenantId, user.tenantId),
        )
        .orderBy(desc(leads.createdAt))
        .limit(200),
    );
    return { leads: rows };
  });

  app.get("/leads/:id", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const { id } = request.params as { id: string };
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [lead] = await tx
        .select({
          id: leads.id,
          name: leads.name,
          email: leads.email,
          phone: leads.phone,
          source: leads.source,
          score: leads.score,
          whatsappOptIn: leads.whatsappOptIn,
          optInAt: leads.optInAt,
          campaignId: leads.campaignId,
          adsetId: leads.adsetId,
          adId: leads.adId,
          trade: leads.trade,
          serviceArea: leads.serviceArea,
          formAnswers: leads.formAnswers,
          createdAt: leads.createdAt,
          stageName: pipelineStages.name,
        })
        .from(leads)
        .leftJoin(pipelineStages, eq(pipelineStages.id, leads.stageId))
        .where(and(eq(leads.id, id), eq(leads.tenantId, user.tenantId)))
        .limit(1);
      if (!lead) throw new HttpError("El lead no existe", 404);
      const events = await tx
        .select({ id: leadEvents.id, type: leadEvents.type, payload: leadEvents.payload, occurredAt: leadEvents.occurredAt })
        .from(leadEvents)
        .where(eq(leadEvents.leadId, id))
        .orderBy(desc(leadEvents.occurredAt))
        .limit(50);
      const [conversation] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.leadId, id))
        .limit(1);
      return { lead, events, conversationId: conversation?.id ?? null };
    });
  });

  // Permiso de WhatsApp: se registra con fecha y origen. Si se concede y hay plantilla
  // de primer contacto configurada, el lead la recibe.
  app.patch("/leads/:id/opt-in", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const { id } = request.params as { id: string };
    const body = optInSchema.parse(request.body);
    await withTenant(deps.db, user.tenantId, async (tx) => {
      const optInAt = body.optIn ? new Date() : null;
      const updated = await tx
        .update(leads)
        .set({ whatsappOptIn: body.optIn, optInAt })
        .where(and(eq(leads.id, id), eq(leads.tenantId, user.tenantId)))
        .returning({ id: leads.id });
      if (!updated[0]) throw new HttpError("El lead no existe", 404);
      await ensureContactFromLead(tx, user.tenantId, id);
      await tx
        .update(contacts)
        .set({ whatsappOptIn: body.optIn, optInAt, updatedAt: new Date() })
        .where(and(eq(contacts.tenantId, user.tenantId), eq(contacts.legacyLeadId, id)));
      await tx.insert(leadEvents).values({
        tenantId: user.tenantId,
        leadId: id,
        type: "opt_in",
        payload: { optIn: body.optIn, origin: body.origin, by: user.id },
      });
    });
    const firstContactSent = body.optIn ? await maybeSendFirstContact(deps, user.tenantId, id) : false;
    return { ok: true, firstContactSent };
  });

  app.get("/conversations", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const result = await withTenant(deps.db, user.tenantId, (tx) =>
      tx.execute(sql`
        SELECT c.id, c.status, c.ai_enabled AS "aiEnabled", c.last_message_at AS "lastMessageAt",
               c.last_inbound_at AS "lastInboundAt", l.id AS "leadId", l.name AS "leadName", l.phone AS "leadPhone",
               (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS "lastContent",
               (SELECT m.direction FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS "lastDirection"
        FROM conversations c
        JOIN leads l ON l.id = c.lead_id
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT 100
      `),
    );
    const rows = result.rows as Array<{ lastInboundAt: Date | string | null } & Record<string, unknown>>;
    return {
      conversations: rows.map((row) => ({
        ...row,
        windowOpen: isWindowOpen(row.lastInboundAt ? new Date(row.lastInboundAt) : null),
      })),
    };
  });

  app.get("/conversations/:id", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const { id } = request.params as { id: string };
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [conversation] = await tx.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (!conversation) throw new HttpError("La conversación no existe", 404);
      const [lead] = await tx
        .select({
          id: leads.id,
          name: leads.name,
          email: leads.email,
          phone: leads.phone,
          source: leads.source,
          whatsappOptIn: leads.whatsappOptIn,
          trade: leads.trade,
          serviceArea: leads.serviceArea,
          formAnswers: leads.formAnswers,
          stageName: pipelineStages.name,
        })
        .from(leads)
        .leftJoin(pipelineStages, eq(pipelineStages.id, leads.stageId))
        .where(eq(leads.id, conversation.leadId))
        .limit(1);
      const thread = await tx
        .select({
          id: messages.id,
          direction: messages.direction,
          senderType: messages.senderType,
          type: messages.type,
          content: messages.content,
          status: messages.status,
          error: messages.error,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(asc(messages.createdAt))
        .limit(500);
      return {
        conversation: {
          id: conversation.id,
          status: conversation.status,
          aiEnabled: conversation.aiEnabled,
          lastInboundAt: conversation.lastInboundAt,
          windowOpen: isWindowOpen(conversation.lastInboundAt),
        },
        lead,
        messages: thread,
      };
    });
  });

  app.post("/conversations/:id/messages", async (request, reply) => {
    const user = await requireUser(request.headers.authorization);
    const { id } = request.params as { id: string };
    const body = sendMessageSchema.parse(request.body);
    const result = await queueOutboundMessage(deps, user.tenantId, { conversationId: id }, body);
    return reply.code(202).send(result);
  });

  // Inbox en tiempo real: eventos SSE de la agencia del usuario.
  app.get("/inbox/stream", async (request, reply) => {
    const user = await requireUser(request.headers.authorization);
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    raw.write(": conectado\n\n");

    const unsubscribe = await deps.realtime.subscribe(user.tenantId, (event) => {
      raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    // Render y otros proxies cierran las conexiones mudas. El latido las mantiene abiertas.
    const heartbeat = setInterval(() => raw.write(": latido\n\n"), 20_000);
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      void unsubscribe();
    });
  });

  app.get("/whatsapp/templates", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const account = await whatsappAccount(deps, user.tenantId);
    const templates = await deps.meta.listTemplates(account.wabaId, account.token);
    const firstContactTemplate = await withTenant(deps.db, user.tenantId, async (tx) => {
      const [tenant] = await tx.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
      return (tenant?.settings as { firstContactTemplate?: unknown } | undefined)?.firstContactTemplate ?? null;
    });
    return { templates, firstContactTemplate };
  });

  app.post("/whatsapp/templates", async (request, reply) => {
    const user = await requireManager(request.headers.authorization);
    const body = createTemplateSchema.parse(request.body);
    const variables = new Set(body.bodyText.match(/\{\{\d+\}\}/g) ?? []);
    if (variables.size !== body.bodyExamples.length) {
      throw new HttpError(
        variables.size === 0
          ? "El texto no tiene variables, quita los ejemplos"
          : `El texto tiene ${variables.size} variable(s) y hacen falta ${variables.size} ejemplo(s)`,
        400,
      );
    }
    const account = await whatsappAccount(deps, user.tenantId);
    const created = await deps.meta.createTemplate(account.wabaId, account.token, body);
    return reply.code(201).send(created);
  });

  app.put("/whatsapp/first-contact-template", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const body = firstContactTemplateSchema.parse(request.body);
    await withTenant(deps.db, user.tenantId, (tx) =>
      tx
        .update(tenants)
        .set({ settings: sql`${tenants.settings} || ${JSON.stringify({ firstContactTemplate: body })}::jsonb` })
        .where(eq(tenants.id, user.tenantId)),
    );
    return { ok: true };
  });

  app.delete("/whatsapp/first-contact-template", async (request) => {
    const user = await requireManager(request.headers.authorization);
    await withTenant(deps.db, user.tenantId, (tx) =>
      tx
        .update(tenants)
        .set({ settings: sql`${tenants.settings} - 'firstContactTemplate'` })
        .where(eq(tenants.id, user.tenantId)),
    );
    return { ok: true };
  });

  // Contactos (tabla separada; backfill desde leads en migración 0004).
  app.get("/contacts", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const { q } = request.query as { q?: string };
    const search = q?.trim();
    const rows = await withTenant(deps.db, user.tenantId, (tx) =>
      tx
        .select({
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          source: contacts.source,
          whatsappOptIn: contacts.whatsappOptIn,
          createdAt: contacts.createdAt,
          legacyLeadId: contacts.legacyLeadId,
        })
        .from(contacts)
        .where(
          search
            ? and(
                eq(contacts.tenantId, user.tenantId),
                or(ilike(contacts.name, `%${search}%`), ilike(contacts.phone, `%${search}%`), ilike(contacts.email, `%${search}%`)),
              )
            : eq(contacts.tenantId, user.tenantId),
        )
        .orderBy(desc(contacts.createdAt))
        .limit(200),
    );
    return { contacts: rows };
  });

  app.get("/contacts/:id", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const { id } = request.params as { id: string };
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [contact] = await tx
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, user.tenantId)))
        .limit(1);
      if (!contact) throw new HttpError("El contacto no existe", 404);
      const opps = await tx
        .select({
          id: opportunities.id,
          name: opportunities.name,
          status: opportunities.status,
          stageName: pipelineStages.name,
          amount: opportunities.amount,
          currency: opportunities.currency,
        })
        .from(opportunities)
        .leftJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
        .where(eq(opportunities.contactId, id))
        .orderBy(desc(opportunities.createdAt));
      const [conversation] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(or(eq(conversations.contactId, id), contact.legacyLeadId ? eq(conversations.leadId, contact.legacyLeadId) : sql`false`))
        .limit(1);
      return { contact, opportunities: opps, conversationId: conversation?.id ?? null };
    });
  });

  app.get("/opportunities", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const rows = await withTenant(deps.db, user.tenantId, (tx) =>
      tx
        .select({
          id: opportunities.id,
          name: opportunities.name,
          status: opportunities.status,
          amount: opportunities.amount,
          currency: opportunities.currency,
          source: opportunities.source,
          stageId: opportunities.stageId,
          stageName: pipelineStages.name,
          contactId: opportunities.contactId,
          contactName: contacts.name,
          contactPhone: contacts.phone,
          createdAt: opportunities.createdAt,
        })
        .from(opportunities)
        .leftJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
        .leftJoin(contacts, eq(contacts.id, opportunities.contactId))
        .where(eq(opportunities.tenantId, user.tenantId))
        .orderBy(desc(opportunities.createdAt))
        .limit(300),
    );
    return { opportunities: rows };
  });
}
