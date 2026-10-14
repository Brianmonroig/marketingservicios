import { and, asc, eq } from "drizzle-orm";
import type { Transaction } from "./db.js";
import { conversations, leads, pipelineStages, tenants } from "./schema.js";

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

// Hasta la fase 5 (agente de IA) las conversaciones nacen en modo humano y sin IA.
export async function getOrCreateConversation(tx: Transaction, tenantId: string, leadId: string) {
  const [created] = await tx
    .insert(conversations)
    .values({ tenantId, leadId, channel: "whatsapp", aiEnabled: false, status: "human" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [existing] = await tx
    .select()
    .from(conversations)
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.leadId, leadId), eq(conversations.channel, "whatsapp")))
    .limit(1);
  if (!existing) throw new Error("No se pudo crear la conversación");
  return existing;
}
