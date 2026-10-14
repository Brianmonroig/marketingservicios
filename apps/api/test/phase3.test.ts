import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  adminPool,
  connectWhatsApp,
  createTenant,
  postSigned,
  prepareEnv,
  request,
  startApp,
  waitFor,
  whatsappMessagePayload,
  whatsappStatusPayload,
  type Running,
  type Tenant,
} from "./helpers.js";

const prefix = `test-f3-${randomUUID()}`;
const admin = adminPool();
let server: Running;
let owner: Tenant;
let other: Tenant;
let phoneNumberId: string;

beforeAll(async () => {
  prepareEnv();
  server = await startApp({ prefix, workers: true });
  owner = await createTenant(server.base, "dueno");
  other = await createTenant(server.base, "otra");
  phoneNumberId = (await connectWhatsApp(server.base, owner.token)).phoneNumberId;
});

afterAll(async () => {
  await server.app.close();
  await admin.end();
});

type ConversationRow = { id: string; leadName: string; leadPhone: string; windowOpen: boolean; lastContent: string };

async function conversationFor(phone: string, token = owner.token) {
  return waitFor(async () => {
    const list = await request(server.base, "/conversations", { token });
    return (list.data.conversations as ConversationRow[]).find((item) => item.leadPhone === phone);
  });
}

async function thread(conversationId: string, token = owner.token) {
  const response = await request(server.base, `/conversations/${conversationId}`, { token });
  return response.data as {
    conversation: { windowOpen: boolean };
    lead: { id: string; whatsappOptIn: boolean };
    messages: Array<{ id: string; direction: string; content: string; status: string; error: string | null; type: string }>;
  };
}

async function readEvents(base: string, token: string, until: (text: string) => boolean, timeoutMs = 10_000) {
  const controller = new AbortController();
  const response = await fetch(`${base}/inbox/stream`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const finished = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return text;
      text += decoder.decode(value, { stream: true });
      if (until(text)) return text;
    }
  })();
  return {
    status: response.status,
    result: Promise.race([
      finished,
      new Promise<string>((_resolve, reject) => setTimeout(() => reject(new Error(`Sin eventos: ${text}`)), timeoutMs)),
    ]).finally(() => controller.abort()),
  };
}

test("un mensaje entrante crea conversación y mensaje y llega al inbox sin recargar", async () => {
  const phone = "+34611000001";
  const stream = await readEvents(server.base, owner.token, (text) => text.includes('"direction":"in"'));
  expect(stream.status).toBe(200);

  const wamid = `wamid.in-${randomUUID()}`;
  const received = await postSigned(
    server.base,
    "/webhooks/whatsapp",
    whatsappMessagePayload({ phoneNumberId, from: "34611000001", id: wamid, text: "Hola, quiero información" }),
  );
  expect(received.status).toBe(200);

  const events = await stream.result;
  expect(events).toContain('"type":"message"');

  const conversation = await conversationFor(phone);
  expect(conversation.leadName).toBe("Carlos Fontanero");
  expect(conversation.windowOpen).toBe(true);
  const messages = (await thread(conversation.id)).messages;
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ direction: "in", content: "Hola, quiero información" });

  // El mismo mensaje duplicado por el webhook no se guarda dos veces.
  await postSigned(
    server.base,
    "/webhooks/whatsapp",
    whatsappMessagePayload({ phoneNumberId, from: "34611000001", id: wamid, text: "Hola, quiero información" }),
  );
  // Y uno distinto sí se guarda, lo que confirma que el worker ya procesó el duplicado.
  await postSigned(
    server.base,
    "/webhooks/whatsapp",
    whatsappMessagePayload({ phoneNumberId, from: "34611000001", id: `wamid.in-${randomUUID()}`, text: "¿Tenéis hueco esta semana?" }),
  );
  await waitFor(async () => (await thread(conversation.id)).messages.length === 2);
  const rows = await admin.query("select count(*)::int as n from messages where external_id = $1", [wamid]);
  expect(rows.rows[0].n).toBe(1);
});

test("dentro de la ventana de 24 h se envía texto y los estados sent, delivered y read se actualizan", async () => {
  const phone = "+34611000002";
  await postSigned(
    server.base,
    "/webhooks/whatsapp",
    whatsappMessagePayload({ phoneNumberId, from: "34611000002", id: `wamid.in-${randomUUID()}`, text: "Hola" }),
  );
  const conversation = await conversationFor(phone);

  const sent = await request(server.base, `/conversations/${conversation.id}/messages`, {
    method: "POST",
    token: owner.token,
    body: { type: "text", text: "Hola, te cuento cómo trabajamos" },
  });
  expect(sent.status).toBe(202);
  const messageId = sent.data.messageId as string;

  const afterSend = await waitFor(async () => (await thread(conversation.id)).messages.find((m) => m.id === messageId && m.status === "sent"));
  expect(afterSend.content).toBe("Hola, te cuento cómo trabajamos");
  expect(server.meta.sent.at(-1)).toMatchObject({
    phoneNumberId,
    input: { type: "text", to: "34611000002", text: "Hola, te cuento cómo trabajamos" },
  });

  const externalId = (await admin.query("select external_id from messages where id = $1", [messageId])).rows[0].external_id as string;
  expect(externalId).toMatch(/^wamid\./);

  for (const status of ["delivered", "read"] as const) {
    await postSigned(server.base, "/webhooks/whatsapp", whatsappStatusPayload({ phoneNumberId, id: externalId, status, recipient: "34611000002" }));
    await waitFor(async () => (await thread(conversation.id)).messages.find((m) => m.id === messageId && m.status === status));
  }

  // Un estado anterior que llega tarde no hace retroceder el mensaje.
  await postSigned(server.base, "/webhooks/whatsapp", whatsappStatusPayload({ phoneNumberId, id: externalId, status: "sent", recipient: "34611000002" }));
  await postSigned(server.base, "/webhooks/whatsapp", whatsappMessagePayload({ phoneNumberId, from: "34611000002", id: `wamid.in-${randomUUID()}`, text: "Gracias" }));
  await waitFor(async () => (await thread(conversation.id)).messages.length === 3);
  expect((await thread(conversation.id)).messages.find((m) => m.id === messageId)?.status).toBe("read");
});

test("fuera de la ventana de 24 h el texto libre se rechaza con un error claro y la plantilla exige permiso", async () => {
  const phone = "+34611000003";
  await postSigned(
    server.base,
    "/webhooks/whatsapp",
    whatsappMessagePayload({ phoneNumberId, from: "34611000003", id: `wamid.in-${randomUUID()}`, text: "Hola" }),
  );
  const conversation = await conversationFor(phone);
  await admin.query("update conversations set last_inbound_at = now() - interval '25 hours' where id = $1", [conversation.id]);

  const closed = await thread(conversation.id);
  expect(closed.conversation.windowOpen).toBe(false);

  const text = await request(server.base, `/conversations/${conversation.id}/messages`, {
    method: "POST",
    token: owner.token,
    body: { type: "text", text: "¿Sigues interesado?" },
  });
  expect(text.status).toBe(409);
  expect(text.data.code).toBe("window_closed");
  expect(String(text.data.error)).toContain("24 h");
  expect(await admin.query("select count(*)::int as n from messages where conversation_id = $1 and direction = 'out'", [conversation.id])).toMatchObject({
    rows: [{ n: 0 }],
  });

  const withoutPermission = await request(server.base, `/conversations/${conversation.id}/messages`, {
    method: "POST",
    token: owner.token,
    body: { type: "template", name: "seguimiento", language: "es", params: ["Carlos"] },
  });
  expect(withoutPermission.status).toBe(409);
  expect(withoutPermission.data.code).toBe("no_opt_in");

  const leadId = (await thread(conversation.id)).lead.id;
  const optIn = await request(server.base, `/leads/${leadId}/opt-in`, {
    method: "PATCH",
    token: owner.token,
    body: { optIn: true, origin: "Lo pidió por teléfono" },
  });
  expect(optIn.status).toBe(200);

  const template = await request(server.base, `/conversations/${conversation.id}/messages`, {
    method: "POST",
    token: owner.token,
    body: { type: "template", name: "seguimiento", language: "es", params: ["Carlos"] },
  });
  expect(template.status).toBe(202);
  await waitFor(async () => (await thread(conversation.id)).messages.find((m) => m.type === "template" && m.status === "sent"));
  expect(server.meta.sent.at(-1)?.input).toMatchObject({ type: "template", name: "seguimiento", language: "es", params: ["Carlos"] });

  const optInRow = await admin.query("select whatsapp_opt_in, opt_in_at from leads where id = $1", [leadId]);
  expect(optInRow.rows[0].whatsapp_opt_in).toBe(true);
  expect(optInRow.rows[0].opt_in_at).not.toBeNull();
});

test("primer contacto: al registrar el permiso, el lead recibe la plantilla configurada", async () => {
  const phone = "+34611000004";
  const lead = await admin.query(
    "insert into leads (tenant_id, name, phone, source) values ($1, 'Lucía Electricista', $2, 'meta_lead_ads') returning id",
    [owner.tenantId, phone],
  );
  const leadId = lead.rows[0].id as string;

  const setting = await request(server.base, "/whatsapp/first-contact-template", {
    method: "PUT",
    token: owner.token,
    body: { name: "primer_contacto", language: "es", params: ["Lucía"] },
  });
  expect(setting.status).toBe(200);

  const optIn = await request(server.base, `/leads/${leadId}/opt-in`, {
    method: "PATCH",
    token: owner.token,
    body: { optIn: true, origin: "Casilla del formulario de Meta" },
  });
  expect(optIn.data.firstContactSent).toBe(true);

  const conversation = await conversationFor(phone);
  const message = await waitFor(async () => (await thread(conversation.id)).messages.find((m) => m.type === "template" && m.status === "sent"));
  expect(message.direction).toBe("out");
  expect(server.meta.sent.at(-1)?.input).toMatchObject({ type: "template", name: "primer_contacto", to: "34611000004" });

  // Con otro permiso registrado no se vuelve a escribir.
  const again = await request(server.base, `/leads/${leadId}/opt-in`, {
    method: "PATCH",
    token: owner.token,
    body: { optIn: true, origin: "Confirmación repetida" },
  });
  expect(again.data.firstContactSent).toBe(false);
});

test("los fallos temporales se reintentan y los definitivos quedan como failed con el motivo", async () => {
  const phone = "+34611000005";
  await postSigned(
    server.base,
    "/webhooks/whatsapp",
    whatsappMessagePayload({ phoneNumberId, from: "34611000005", id: `wamid.in-${randomUUID()}`, text: "Hola" }),
  );
  const conversation = await conversationFor(phone);

  const sentBefore = server.meta.sent.length;
  server.meta.failNextSends = 2;
  const retried = await request(server.base, `/conversations/${conversation.id}/messages`, {
    method: "POST",
    token: owner.token,
    body: { type: "text", text: "Primer intento con fallo" },
  });
  await waitFor(async () => (await thread(conversation.id)).messages.find((m) => m.id === retried.data.messageId && m.status === "sent"), 15_000);
  expect(server.meta.sent.length).toBe(sentBefore + 1);

  server.meta.failNextSends = 100;
  const lost = await request(server.base, `/conversations/${conversation.id}/messages`, {
    method: "POST",
    token: owner.token,
    body: { type: "text", text: "Este no sale" },
  });
  const failed = await waitFor(async () => (await thread(conversation.id)).messages.find((m) => m.id === lost.data.messageId && m.status === "failed"), 20_000);
  expect(failed.error).toContain("Servicio no disponible");
  server.meta.failNextSends = 0;
});

test("el estado failed de Meta queda registrado en el mensaje", async () => {
  const phone = "+34611000006";
  await postSigned(
    server.base,
    "/webhooks/whatsapp",
    whatsappMessagePayload({ phoneNumberId, from: "34611000006", id: `wamid.in-${randomUUID()}`, text: "Hola" }),
  );
  const conversation = await conversationFor(phone);
  const sent = await request(server.base, `/conversations/${conversation.id}/messages`, {
    method: "POST",
    token: owner.token,
    body: { type: "text", text: "Mensaje que Meta no entrega" },
  });
  await waitFor(async () => (await thread(conversation.id)).messages.find((m) => m.id === sent.data.messageId && m.status === "sent"));
  const externalId = (await admin.query("select external_id from messages where id = $1", [sent.data.messageId])).rows[0].external_id as string;
  await postSigned(server.base, "/webhooks/whatsapp", {
    ...whatsappStatusPayload({ phoneNumberId, id: externalId, status: "failed", recipient: "34611000006" }),
    entry: [
      {
        id: "9998887776",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: phoneNumberId },
              statuses: [{ id: externalId, status: "failed", errors: [{ code: 131026, title: "Message undeliverable" }] }],
            },
          },
        ],
      },
    ],
  });
  const failed = await waitFor(async () => (await thread(conversation.id)).messages.find((m) => m.id === sent.data.messageId && m.status === "failed"));
  expect(failed.error).toContain("131026");
});

test("otra agencia no puede leer ni escribir en las conversaciones", async () => {
  const phone = "+34611000001";
  const conversation = await conversationFor(phone);

  const read = await request(server.base, `/conversations/${conversation.id}`, { token: other.token });
  expect(read.status).toBe(404);
  const write = await request(server.base, `/conversations/${conversation.id}/messages`, {
    method: "POST",
    token: other.token,
    body: { type: "text", text: "intruso" },
  });
  expect(write.status).toBe(404);
  const list = await request(server.base, "/conversations", { token: other.token });
  expect((list.data.conversations as unknown[]).length).toBe(0);
});

test("las plantillas se listan desde Meta y la creación valida variables y ejemplos", async () => {
  server.meta.templates = [
    { name: "seguimiento", language: "es", status: "APPROVED", category: "UTILITY", bodyText: "Hola {{1}}" },
    { name: "oferta", language: "es", status: "PENDING", category: "MARKETING", bodyText: "Oferta" },
  ];
  const list = await request(server.base, "/whatsapp/templates", { token: owner.token });
  expect(list.status).toBe(200);
  expect((list.data.templates as Array<{ name: string; status: string }>).map((t) => `${t.name}:${t.status}`)).toEqual([
    "seguimiento:APPROVED",
    "oferta:PENDING",
  ]);

  const missingExample = await request(server.base, "/whatsapp/templates", {
    method: "POST",
    token: owner.token,
    body: { name: "nueva", language: "es", category: "UTILITY", bodyText: "Hola {{1}}", bodyExamples: [] },
  });
  expect(missingExample.status).toBe(400);

  const created = await request(server.base, "/whatsapp/templates", {
    method: "POST",
    token: owner.token,
    body: { name: "nueva", language: "es", category: "UTILITY", bodyText: "Hola {{1}}", bodyExamples: ["Carlos"] },
  });
  expect(created.status).toBe(201);
  expect(created.data.status).toBe("PENDING");
  expect(server.meta.createdTemplates.at(-1)).toMatchObject({ name: "nueva", bodyExamples: ["Carlos"] });

  const withoutWhatsApp = await request(server.base, "/whatsapp/templates", { token: other.token });
  expect(withoutWhatsApp.status).toBe(409);
});

test("el token de WhatsApp se guarda cifrado y un agente no puede gestionar integraciones", async () => {
  const stored = await admin.query("select access_token_encrypted from integrations where provider = 'whatsapp' and tenant_id = $1", [owner.tenantId]);
  expect(stored.rows[0].access_token_encrypted).not.toContain("token-de-whatsapp");

  const created = await request(server.base, "/admin/users", {
    method: "POST",
    token: owner.token,
    body: { name: "Agente Uno", email: `agente-${randomUUID()}@example.com`, password: "clave-segura", role: "agent" },
  });
  expect(created.status).toBe(201);
  const agentEmail = (await admin.query("select email from users where tenant_id = $1 and role = 'agent' limit 1", [owner.tenantId])).rows[0].email as string;
  const { lastCode } = await import("../src/mailer.mock-store.js");
  await request(server.base, "/auth/verify-email", { method: "POST", body: { email: agentEmail, code: lastCode(agentEmail, "verify_email") } });
  const login = await request(server.base, "/auth/login", { method: "POST", body: { email: agentEmail, password: "clave-segura" } });
  const session = await request(server.base, "/auth/verify-2fa", {
    method: "POST",
    body: { email: agentEmail, challengeId: login.data.challengeId, code: lastCode(agentEmail, "login_2fa") },
  });
  const agentToken = session.data.token as string;

  expect((await request(server.base, "/integrations", { token: agentToken })).status).toBe(403);
  expect((await request(server.base, "/whatsapp/templates", { token: agentToken })).status).toBe(200);
  expect((await request(server.base, "/conversations", { token: agentToken })).status).toBe(200);
});
