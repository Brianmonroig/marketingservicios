import { and, asc, eq, sql } from "drizzle-orm";
import { HttpError } from "./accounts.js";
import type { Transaction } from "./db.js";
import { contacts, conversations, leads, messages, opportunities, pipelineStages, tenants, tickets } from "./schema.js";

type Settings = Record<string, unknown>;

function asObject(value: unknown): Settings {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Settings) : {};
}

async function stages(tx: Transaction, tenantId: string) {
  return tx
    .select({ id: pipelineStages.id, name: pipelineStages.name, position: pipelineStages.position })
    .from(pipelineStages)
    .where(eq(pipelineStages.tenantId, tenantId))
    .orderBy(asc(pipelineStages.position));
}

/** Carga un CRM de ejemplo completo (contactos, oportunidades, tickets, chat local). Idempotente. */
export async function seedDemoCrm(tx: Transaction, tenantId: string, actorUserId: string) {
  const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new HttpError("No encontramos la agencia", 404);
  const settings = asObject(tenant.settings);
  const [existingDemo] = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.source, "demo")))
    .limit(1);
  if (existingDemo || settings.demoSeededAt) {
    const [demoChat] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), eq(conversations.channel, "demo")))
      .limit(1);
    return {
      alreadySeeded: true as const,
      seededAt: String(settings.demoSeededAt ?? ""),
      conversationId: demoChat?.id,
      contactIds: existingDemo ? [existingDemo.id] : [],
    };
  }

  const stageRows = await stages(tx, tenantId);
  if (stageRows.length === 0) throw new HttpError("No hay etapas de pipeline. Crea etapas en Configuración.", 409);
  const stageAt = (index: number) => stageRows[Math.min(index, stageRows.length - 1)]!.id;

  const [leadA] = await tx
    .insert(leads)
    .values({
      tenantId,
      name: "María Fontanera (ejemplo)",
      email: "maria.ejemplo@northscale.demo",
      phone: "+34600111222",
      stageId: stageAt(0),
      source: "demo",
      whatsappOptIn: true,
      optInAt: new Date(),
      trade: "Fontanería",
      serviceArea: "Madrid centro",
      formAnswers: { servicio: "Fuga en cocina", urgencia: "Alta" },
    })
    .returning();
  const [leadB] = await tx
    .insert(leads)
    .values({
      tenantId,
      name: "Carlos Clima (ejemplo)",
      email: "carlos.ejemplo@northscale.demo",
      phone: "+34600333444",
      stageId: stageAt(2),
      source: "demo",
      whatsappOptIn: true,
      optInAt: new Date(),
      trade: "Climatización",
      serviceArea: "Alcobendas",
      formAnswers: { servicio: "Instalación split", presupuesto: "1500" },
    })
    .returning();
  if (!leadA || !leadB) throw new Error("No se pudieron crear leads de ejemplo");

  const [contactA] = await tx
    .insert(contacts)
    .values({
      tenantId,
      name: leadA.name,
      email: leadA.email,
      phone: leadA.phone,
      source: "demo",
      whatsappOptIn: true,
      optInAt: leadA.optInAt,
      trade: leadA.trade,
      serviceArea: leadA.serviceArea,
      formAnswers: leadA.formAnswers ?? {},
      legacyLeadId: leadA.id,
    })
    .returning();
  const [contactB] = await tx
    .insert(contacts)
    .values({
      tenantId,
      name: leadB.name,
      email: leadB.email,
      phone: leadB.phone,
      source: "demo",
      whatsappOptIn: true,
      optInAt: leadB.optInAt,
      trade: leadB.trade,
      serviceArea: leadB.serviceArea,
      formAnswers: leadB.formAnswers ?? {},
      legacyLeadId: leadB.id,
    })
    .returning();
  if (!contactA || !contactB) throw new Error("No se pudieron crear contactos de ejemplo");

  await tx.insert(opportunities).values([
    {
      tenantId,
      contactId: contactA.id,
      stageId: stageAt(0),
      name: "Fuga cocina · María",
      amount: "320.00",
      currency: "EUR",
      source: "demo",
      status: "open",
      legacyLeadId: leadA.id,
    },
    {
      tenantId,
      contactId: contactA.id,
      stageId: stageAt(1),
      name: "Mantenimiento anual · María",
      amount: "180.00",
      currency: "EUR",
      source: "demo",
      status: "open",
    },
    {
      tenantId,
      contactId: contactB.id,
      stageId: stageAt(2),
      name: "Instalación split · Carlos",
      amount: "1500.00",
      currency: "EUR",
      source: "demo",
      status: "open",
      legacyLeadId: leadB.id,
    },
    {
      tenantId,
      contactId: contactB.id,
      stageId: stageAt(Math.min(3, stageRows.length - 1)),
      name: "Revisión conductos · Carlos",
      amount: "90.00",
      currency: "EUR",
      source: "demo",
      status: "open",
    },
  ]);

  const now = Date.now();
  const [conversation] = await tx
    .insert(conversations)
    .values({
      tenantId,
      leadId: leadA.id,
      contactId: contactA.id,
      channel: "demo",
      aiEnabled: false,
      status: "human",
      lastMessageAt: new Date(now),
      lastInboundAt: new Date(now - 5 * 60_000),
    })
    .returning();
  if (!conversation) throw new Error("No se pudo crear la conversación de ejemplo");

  const thread: Array<{ direction: "in" | "out"; senderType: "lead" | "user"; content: string; minutesAgo: number }> = [
    { direction: "in", senderType: "lead", content: "Hola, tengo una fuga bajo el fregadero. ¿Podéis venir hoy?", minutesAgo: 45 },
    { direction: "out", senderType: "user", content: "Hola María, soy del equipo. ¿Puedes enviarme una foto de la fuga?", minutesAgo: 40 },
    { direction: "in", senderType: "lead", content: "Sí, te la mando. Es en la cocina, gota constante.", minutesAgo: 35 },
    { direction: "out", senderType: "user", content: "Recibido. Te agendo visita esta tarde entre 17 y 19 h.", minutesAgo: 30 },
    { direction: "in", senderType: "lead", content: "Perfecto, gracias.", minutesAgo: 5 },
  ];

  for (const item of thread) {
    await tx.insert(messages).values({
      tenantId,
      conversationId: conversation.id,
      direction: item.direction,
      senderType: item.senderType,
      type: "text",
      content: item.content,
      status: "delivered",
      createdAt: new Date(now - item.minutesAgo * 60_000),
    });
  }

  await tx.insert(tickets).values([
    {
      tenantId,
      contactId: contactA.id,
      conversationId: conversation.id,
      title: "Visita fuga cocina (ejemplo)",
      description: "Ticket generado desde el chat de ejemplo con María.",
      status: "nuevo",
      priority: "high",
      assigneeId: actorUserId,
      source: "demo",
    },
    {
      tenantId,
      contactId: contactA.id,
      title: "Presupuesto junta (ejemplo)",
      description: "Pedir presupuesto de junta y silicona.",
      status: "abierto",
      priority: "normal",
      source: "demo",
    },
    {
      tenantId,
      contactId: contactB.id,
      title: "Medición split (ejemplo)",
      description: "Confirmar medidas de pared antes de instalar.",
      status: "pendiente",
      priority: "normal",
      source: "demo",
    },
    {
      tenantId,
      contactId: contactB.id,
      title: "Entrega documentación (ejemplo)",
      description: "Enviar garantía y ficha técnica al cliente.",
      status: "resuelto",
      priority: "low",
      source: "demo",
    },
  ]);

  const seededAt = new Date().toISOString();
  await tx
    .update(tenants)
    .set({
      settings: sql`${tenants.settings} || ${JSON.stringify({ demoSeededAt: seededAt })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  return {
    alreadySeeded: false as const,
    seededAt,
    contactIds: [contactA.id, contactB.id],
    conversationId: conversation.id,
  };
}
