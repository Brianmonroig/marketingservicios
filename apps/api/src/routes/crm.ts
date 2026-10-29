import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  contactWriteSchema,
  createTemplateSchema,
  firstContactTemplateSchema,
  optInSchema,
  opportunityWriteSchema,
  sendMessageSchema,
  ticketWriteSchema,
} from "@crm/shared";
import { HttpError } from "../accounts.js";
import { ensureContactFromLead, firstStageId } from "../crm-data.js";
import { decryptToken } from "../crypto.js";
import { withTenant } from "../db.js";
import { seedDemoCrm } from "../demo-seed.js";
import type { Deps } from "../deps.js";
import { requireManager, requireUser } from "../guard.js";
import { isWindowOpen, maybeSendFirstContact, queueOutboundMessage } from "../outbound.js";
import {
  contacts,
  conversations,
  integrations,
  leadEvents,
  leads,
  messages,
  opportunities,
  pipelineStages,
  tenants,
  tickets,
} from "../schema.js";

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
        SELECT c.id, c.status, c.channel, c.ai_enabled AS "aiEnabled", c.last_message_at AS "lastMessageAt",
               c.last_inbound_at AS "lastInboundAt", c.contact_id AS "contactId",
               l.id AS "leadId", l.name AS "leadName", l.phone AS "leadPhone",
               (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS "lastContent",
               (SELECT m.direction FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS "lastDirection"
        FROM conversations c
        JOIN leads l ON l.id = c.lead_id
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT 100
      `),
    );
    const rows = result.rows as Array<{ lastInboundAt: Date | string | null; channel: string } & Record<string, unknown>>;
    return {
      conversations: rows.map((row) => ({
        ...row,
        windowOpen: row.channel === "demo" ? true : isWindowOpen(row.lastInboundAt ? new Date(row.lastInboundAt) : null),
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
      let contactId = conversation.contactId;
      if (!contactId && lead) {
        const [linked] = await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.tenantId, user.tenantId), eq(contacts.legacyLeadId, lead.id)))
          .limit(1);
        contactId = linked?.id ?? null;
      }
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
      const isDemo = conversation.channel === "demo";
      return {
        conversation: {
          id: conversation.id,
          status: conversation.status,
          channel: conversation.channel,
          aiEnabled: conversation.aiEnabled,
          lastInboundAt: conversation.lastInboundAt,
          contactId,
          windowOpen: isDemo ? true : isWindowOpen(conversation.lastInboundAt),
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

    const channel = await withTenant(deps.db, user.tenantId, async (tx) => {
      const [row] = await tx
        .select({ channel: conversations.channel })
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.tenantId, user.tenantId)))
        .limit(1);
      if (!row) throw new HttpError("La conversación no existe", 404);
      return row.channel;
    });

    if (channel === "demo") {
      if (body.type !== "text") throw new HttpError("En el chat de ejemplo solo se admite texto", 400);
      const result = await withTenant(deps.db, user.tenantId, async (tx) => {
        const [message] = await tx
          .insert(messages)
          .values({
            tenantId: user.tenantId,
            conversationId: id,
            direction: "out",
            senderType: "user",
            type: "text",
            content: body.text,
            status: "delivered",
          })
          .returning({ id: messages.id });
        await tx
          .update(conversations)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(conversations.id, id));
        return { messageId: message!.id, conversationId: id };
      });
      await deps.realtime.publish(user.tenantId, {
        type: "message",
        conversationId: id,
        messageId: result.messageId,
        direction: "out",
      });
      return reply.code(201).send(result);
    }

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

  app.post("/crm/demo-seed", async (request, reply) => {
    const user = await requireManager(request.headers.authorization);
    const result = await withTenant(deps.db, user.tenantId, (tx) => seedDemoCrm(tx, user.tenantId, user.id));
    return reply.code(result.alreadySeeded ? 200 : 201).send({ ok: true, ...result });
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

  app.post("/contacts", async (request, reply) => {
    const user = await requireUser(request.headers.authorization);
    const body = contactWriteSchema.parse(request.body);
    const email = body.email === "" || body.email == null ? null : body.email;
    const created = await withTenant(deps.db, user.tenantId, async (tx) => {
      const stageId = await firstStageId(tx, user.tenantId);
      const [lead] = await tx
        .insert(leads)
        .values({
          tenantId: user.tenantId,
          name: body.name ?? null,
          email,
          phone: body.phone ?? null,
          stageId,
          source: "manual",
          whatsappOptIn: body.whatsappOptIn ?? false,
          optInAt: body.whatsappOptIn ? new Date() : null,
          trade: body.trade ?? null,
          serviceArea: body.serviceArea ?? null,
        })
        .returning();
      if (!lead) throw new Error("No se pudo crear el lead espejo");
      await tx.insert(leadEvents).values({
        tenantId: user.tenantId,
        leadId: lead.id,
        type: "lead_created",
        payload: { source: "manual", by: user.id },
      });
      const contact = await ensureContactFromLead(tx, user.tenantId, lead.id);
      if (!contact) throw new Error("No se pudo crear el contacto");
      if (body.name || body.trade || body.serviceArea) {
        const [updated] = await tx
          .update(contacts)
          .set({
            name: body.name ?? contact.name,
            trade: body.trade ?? contact.trade,
            serviceArea: body.serviceArea ?? contact.serviceArea,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id))
          .returning();
        return updated ?? contact;
      }
      return contact;
    });
    return reply.code(201).send({ contact: created });
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
      const ticketRows = await tx
        .select({
          id: tickets.id,
          title: tickets.title,
          status: tickets.status,
          priority: tickets.priority,
        })
        .from(tickets)
        .where(eq(tickets.contactId, id))
        .orderBy(desc(tickets.createdAt));
      const [conversation] = await tx
        .select({ id: conversations.id, channel: conversations.channel })
        .from(conversations)
        .where(or(eq(conversations.contactId, id), contact.legacyLeadId ? eq(conversations.leadId, contact.legacyLeadId) : sql`false`))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(1);
      return { contact, opportunities: opps, tickets: ticketRows, conversationId: conversation?.id ?? null };
    });
  });

  app.patch("/contacts/:id", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const { id } = request.params as { id: string };
    const body = contactWriteSchema.parse(request.body);
    const email = body.email === "" ? null : body.email;
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [updated] = await tx
        .update(contacts)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.trade !== undefined ? { trade: body.trade } : {}),
          ...(body.serviceArea !== undefined ? { serviceArea: body.serviceArea } : {}),
          ...(body.whatsappOptIn !== undefined
            ? { whatsappOptIn: body.whatsappOptIn, optInAt: body.whatsappOptIn ? new Date() : null }
            : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, user.tenantId)))
        .returning();
      if (!updated) throw new HttpError("El contacto no existe", 404);
      if (updated.legacyLeadId) {
        await tx
          .update(leads)
          .set({
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
            trade: updated.trade,
            serviceArea: updated.serviceArea,
            whatsappOptIn: updated.whatsappOptIn,
            optInAt: updated.optInAt,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, updated.legacyLeadId));
      }
      return { contact: updated };
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

  app.post("/opportunities", async (request, reply) => {
    const user = await requireUser(request.headers.authorization);
    const body = opportunityWriteSchema
      .refine((value) => Boolean(value.contactId && value.name), { message: "Indica contacto y nombre" })
      .parse(request.body);
    const created = await withTenant(deps.db, user.tenantId, async (tx) => {
      const [contact] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, body.contactId!), eq(contacts.tenantId, user.tenantId)))
        .limit(1);
      if (!contact) throw new HttpError("El contacto no existe", 404);
      const stageId = body.stageId ?? (await firstStageId(tx, user.tenantId));
      const [row] = await tx
        .insert(opportunities)
        .values({
          tenantId: user.tenantId,
          contactId: contact.id,
          stageId,
          name: body.name!,
          amount: body.amount ?? null,
          currency: body.currency ?? "EUR",
          status: body.status ?? "open",
          source: body.source ?? "manual",
        })
        .returning();
      return row;
    });
    return reply.code(201).send({ opportunity: created });
  });

  app.patch("/opportunities/:id", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const { id } = request.params as { id: string };
    const body = opportunityWriteSchema.parse(request.body);
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [updated] = await tx
        .update(opportunities)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.stageId !== undefined ? { stageId: body.stageId } : {}),
          ...(body.amount !== undefined ? { amount: body.amount } : {}),
          ...(body.currency !== undefined ? { currency: body.currency } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(opportunities.id, id), eq(opportunities.tenantId, user.tenantId)))
        .returning();
      if (!updated) throw new HttpError("La oportunidad no existe", 404);
      return { opportunity: updated };
    });
  });

  app.get("/tickets", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const rows = await withTenant(deps.db, user.tenantId, (tx) =>
      tx
        .select({
          id: tickets.id,
          title: tickets.title,
          description: tickets.description,
          status: tickets.status,
          priority: tickets.priority,
          source: tickets.source,
          contactId: tickets.contactId,
          contactName: contacts.name,
          conversationId: tickets.conversationId,
          createdAt: tickets.createdAt,
        })
        .from(tickets)
        .leftJoin(contacts, eq(contacts.id, tickets.contactId))
        .where(eq(tickets.tenantId, user.tenantId))
        .orderBy(desc(tickets.createdAt))
        .limit(300),
    );
    return { tickets: rows };
  });

  app.post("/tickets", async (request, reply) => {
    const user = await requireUser(request.headers.authorization);
    const body = ticketWriteSchema
      .refine((value) => Boolean(value.contactId && value.title), { message: "Indica contacto y título" })
      .parse(request.body);
    const created = await withTenant(deps.db, user.tenantId, async (tx) => {
      const [contact] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, body.contactId!), eq(contacts.tenantId, user.tenantId)))
        .limit(1);
      if (!contact) throw new HttpError("El contacto no existe", 404);
      const [row] = await tx
        .insert(tickets)
        .values({
          tenantId: user.tenantId,
          contactId: contact.id,
          conversationId: body.conversationId ?? null,
          title: body.title!,
          description: body.description ?? null,
          status: body.status ?? "nuevo",
          priority: body.priority ?? "normal",
          assigneeId: user.id,
          source: "manual",
        })
        .returning();
      return row;
    });
    return reply.code(201).send({ ticket: created });
  });

  app.patch("/tickets/:id", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const { id } = request.params as { id: string };
    const body = ticketWriteSchema.parse(request.body);
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [updated] = await tx
        .update(tickets)
        .set({
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          ...(body.conversationId !== undefined ? { conversationId: body.conversationId } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(tickets.id, id), eq(tickets.tenantId, user.tenantId)))
        .returning();
      if (!updated) throw new HttpError("El ticket no existe", 404);
      return { ticket: updated };
    });
  });
}
