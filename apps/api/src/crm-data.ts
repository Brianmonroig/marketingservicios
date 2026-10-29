import { and, asc, eq } from "drizzle-orm";
import type { Transaction } from "./db.js";
import { contacts, conversations, leads, opportunities, pipelineStages, tenants } from "./schema.js";

export async function tenantCountry(tx: Transaction, tenantId: string): Promise<string | undefined> {
  const [row] = await tx.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = (row?.settings ?? {}) as { jurisdiction?: string };
  return settings.jurisdiction;
}

export async function firstStageId(tx: Transaction, tenantId: string): Promise<string | null> {
  const [stage] = await tx
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(eq(pipelineStages.tenantId, tenantId))
    .orderBy(asc(pipelineStages.position))
    .limit(1);
  return stage?.id ?? null;
}

export async function findLeadByPhone(tx: Transaction, tenantId: string, phone: string) {
  const [lead] = await tx
    .select()
    .from(leads)
    .where(and(eq(leads.tenantId, tenantId), eq(leads.phone, phone)))
    .limit(1);
  return lead ?? null;
}

/** Espejo lead → contacto + oportunidad (idempotente por legacy_lead_id). */
export async function ensureContactFromLead(tx: Transaction, tenantId: string, leadId: string) {
  const [lead] = await tx
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);
  if (!lead) return null;

  const [existing] = await tx
    .select()
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.legacyLeadId, leadId)))
    .limit(1);

  const contact =
    existing ??
    (
      await tx
        .insert(contacts)
        .values({
          tenantId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          whatsappOptIn: lead.whatsappOptIn,
          optInAt: lead.optInAt,
          trade: lead.trade,
          serviceArea: lead.serviceArea,
          formAnswers: lead.formAnswers ?? {},
          assignedTo: lead.assignedTo,
          legacyLeadId: lead.id,
        })
        .returning()
    )[0];

  if (!contact) return null;

  const [opp] = await tx
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(and(eq(opportunities.tenantId, tenantId), eq(opportunities.legacyLeadId, leadId)))
    .limit(1);

  if (!opp) {
    await tx.insert(opportunities).values({
      tenantId,
      contactId: contact.id,
      stageId: lead.stageId,
      name: lead.name ?? lead.phone ?? lead.email ?? "Oportunidad",
      source: lead.source,
      status: "open",
      assignedTo: lead.assignedTo,
      campaignId: lead.campaignId,
      adsetId: lead.adsetId,
      adId: lead.adId,
      metaLeadId: lead.metaLeadId,
      legacyLeadId: lead.id,
    });
  }

  return contact;
}

// Hasta la fase 5 (agente de IA) las conversaciones nacen en modo humano y sin IA.
export async function getOrCreateConversation(tx: Transaction, tenantId: string, leadId: string) {
  const contact = await ensureContactFromLead(tx, tenantId, leadId);
  const [created] = await tx
    .insert(conversations)
    .values({
      tenantId,
      leadId,
      contactId: contact?.id ?? null,
      channel: "whatsapp",
      aiEnabled: false,
      status: "human",
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [existing] = await tx
    .select()
    .from(conversations)
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.leadId, leadId), eq(conversations.channel, "whatsapp")))
    .limit(1);
  if (!existing) throw new Error("No se pudo crear la conversación");
  if (!existing.contactId && contact?.id) {
    const [updated] = await tx
      .update(conversations)
      .set({ contactId: contact.id, updatedAt: new Date() })
      .where(eq(conversations.id, existing.id))
      .returning();
    return updated ?? existing;
  }
  return existing;
}
