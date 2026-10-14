import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { decryptToken } from "../src/crypto.js";
import { sweepWebhookEvents } from "../src/ingest.js";
import {
  VERIFY_TOKEN,
  adminPool,
  connectPage,
  createTenant,
  leadgenPayload,
  postSigned,
  prepareEnv,
  request,
  sign,
  startApp,
  waitFor,
  type Running,
  type Tenant,
} from "./helpers.js";

const prefix = `test-f2-${randomUUID()}`;
const admin = adminPool();
let stopped: Running; // API con la cola detenida: recibe y guarda, no procesa
let working: Running; // API con worker, comparte la misma cola
let owner: Tenant;
let other: Tenant;

beforeAll(async () => {
  prepareEnv();
  stopped = await startApp({ prefix, workers: false });
  working = await startApp({ prefix, workers: true, meta: stopped.meta });
  owner = await createTenant(stopped.base, "dueno");
  other = await createTenant(stopped.base, "otra");
});

afterAll(async () => {
  await stopped.app.close();
  await working.app.close();
  await admin.end();
});

async function webhookRows(externalId: string) {
  const result = await admin.query("select tenant_id, processed_at from webhook_events where external_id = $1", [externalId]);
  return result.rows as Array<{ tenant_id: string | null; processed_at: Date | null }>;
}

test("Meta verifica el webhook con el token y rechaza uno incorrecto", async () => {
  const ok = await request(stopped.base, `/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=reto-123`);
  expect(ok.status).toBe(200);
  expect(ok.data.text).toBe("reto-123");

  const bad = await request(stopped.base, "/webhooks/meta?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=reto-123");
  expect(bad.status).toBe(403);
});

test("una firma inválida responde 401 y no guarda nada", async () => {
  const leadgenId = `lead-firma-${randomUUID()}`;
  const raw = JSON.stringify(leadgenPayload({ pageId: "777", leadgenId }));

  const wrong = await request(stopped.base, "/webhooks/meta", {
    method: "POST",
    rawBody: raw,
    headers: { "x-hub-signature-256": sign(raw, "secreto-equivocado") },
  });
  const missing = await request(stopped.base, "/webhooks/meta", { method: "POST", rawBody: raw });

  expect(wrong.status).toBe(401);
  expect(missing.status).toBe(401);
  expect(await webhookRows(leadgenId)).toHaveLength(0);
});

test("con la cola detenida el webhook responde en menos de 2 s y el worker crea el lead después, una sola vez", async () => {
  const pageId = `page-${randomUUID().slice(0, 8)}`;
  const connected = await connectPage(stopped.base, owner.token, stopped.meta, pageId);
  expect(connected.activated.status).toBe(200);
  expect(stopped.meta.subscribed).toContain(pageId);

  // Para que el worker de "working" no coja el trabajo hasta que lo pidamos, el lead
  // se prepara en el mock antes de enviar el webhook.
  const leadgenId = `lead-${randomUUID()}`;
  stopped.meta.leads.set(leadgenId, {
    id: leadgenId,
    createdTime: new Date().toISOString(),
    adId: "ad-9",
    adsetId: "adset-9",
    campaignId: "camp-9",
    formId: "form-9",
    fields: [
      { name: "full_name", values: ["María Pérez"] },
      { name: "email", values: ["MARIA@Example.com"] },
      { name: "phone_number", values: ["612 34 56 78"] },
      { name: "que_oficio_tienes", values: ["Fontanería"] },
    ],
  });

  const payload = leadgenPayload({ pageId, leadgenId });
  const started = Date.now();
  const first = await postSigned(stopped.base, "/webhooks/meta", payload);
  const elapsed = Date.now() - started;
  expect(first.status).toBe(200);
  expect(elapsed).toBeLessThan(2000);

  // El mismo evento otra vez: Meta reintenta si no recibe 200 a tiempo.
  const second = await postSigned(stopped.base, "/webhooks/meta", payload);
  expect(second.status).toBe(200);
  expect(await webhookRows(leadgenId)).toHaveLength(1);

  const lead = await waitFor(async () => {
    const list = await request(working.base, "/leads", { token: owner.token });
    const leads = list.data.leads as Array<{ id: string; name: string; email: string; phone: string; source: string; stageName: string }>;
    return leads.find((item) => item.name === "María Pérez");
  });
  expect(lead.phone).toBe("+34612345678");
  expect(lead.email).toBe("maria@example.com");
  expect(lead.source).toBe("meta_lead_ads");
  expect(lead.stageName).toBe("Nuevo");

  const count = await admin.query("select count(*)::int as n from leads where meta_lead_id = $1", [leadgenId]);
  expect(count.rows[0].n).toBe(1);

  const detail = await request(working.base, `/leads/${lead.id}`, { token: owner.token });
  const events = detail.data.events as Array<{ type: string }>;
  expect(events.map((event) => event.type)).toContain("lead_created");
  const lastRow = (await webhookRows(leadgenId))[0];
  expect(lastRow?.processed_at).not.toBeNull();
  expect(lastRow?.tenant_id).toBe(owner.tenantId);
});

test("un evento de una página sin conectar no crea leads y queda cerrado", async () => {
  const leadgenId = `lead-sin-pagina-${randomUUID()}`;
  const response = await postSigned(stopped.base, "/webhooks/meta", leadgenPayload({ pageId: "pagina-desconocida", leadgenId }));
  expect(response.status).toBe(200);
  await waitFor(async () => (await webhookRows(leadgenId))[0]?.processed_at);
  const count = await admin.query("select count(*)::int as n from leads where meta_lead_id = $1", [leadgenId]);
  expect(count.rows[0].n).toBe(0);
});

test("el barrido vuelve a encolar los eventos pendientes de más de 2 minutos", async () => {
  const pageId = `page-barrido-${randomUUID().slice(0, 8)}`;
  await connectPage(stopped.base, owner.token, stopped.meta, pageId);
  const leadgenId = `lead-barrido-${randomUUID()}`;
  // Sin datos en el mock, el procesamiento falla y el evento queda pendiente.
  await postSigned(stopped.base, "/webhooks/meta", leadgenPayload({ pageId, leadgenId }));
  await admin.query("update webhook_events set created_at = now() - interval '5 minutes' where external_id = $1", [leadgenId]);
  const requeued = await sweepWebhookEvents(working.app.deps);
  expect(requeued).toBeGreaterThanOrEqual(1);
});

test("el token de la página se guarda cifrado y otra agencia no ve la conexión", async () => {
  const pageId = `page-cifrado-${randomUUID().slice(0, 8)}`;
  await connectPage(stopped.base, owner.token, stopped.meta, pageId);

  const stored = await admin.query("select access_token_encrypted, status from integrations where external_account_id = $1", [pageId]);
  const encrypted = stored.rows[0].access_token_encrypted as string;
  expect(stored.rows[0].status).toBe("active");
  expect(encrypted).not.toContain(`token-pagina-${pageId}`);
  expect(decryptToken(encrypted)).toBe(`token-pagina-${pageId}`);

  const mine = await request(stopped.base, "/integrations", { token: owner.token });
  expect(JSON.stringify(mine.data)).not.toContain("token-pagina");
  expect((mine.data.integrations as Array<{ externalAccountId: string }>).some((item) => item.externalAccountId === pageId)).toBe(true);

  const theirs = await request(stopped.base, "/integrations", { token: other.token });
  expect((theirs.data.integrations as unknown[]).length).toBe(0);

  const leadsOfOther = await request(stopped.base, "/leads", { token: other.token });
  expect((leadsOfOther.data.leads as unknown[]).length).toBe(0);
});

test("una página activa en una agencia no se puede activar en otra", async () => {
  const pageId = `page-doble-${randomUUID().slice(0, 8)}`;
  await connectPage(stopped.base, owner.token, stopped.meta, pageId);
  const second = await connectPage(stopped.base, other.token, stopped.meta, pageId);
  expect(second.activated.status).toBe(409);
});

test("el estado de OAuth de otra sesión se rechaza", async () => {
  stopped.meta.pages = [];
  const urlResponse = await request(stopped.base, "/integrations/meta/oauth-url", {
    method: "POST",
    token: owner.token,
    body: { redirectUri: "http://localhost:3000/api/meta/callback" },
  });
  const state = new URL(urlResponse.data.url as string).searchParams.get("state") as string;
  const stolen = await request(stopped.base, "/integrations/meta/oauth-exchange", {
    method: "POST",
    token: other.token,
    body: { code: "codigo-valido", state, redirectUri: "http://localhost:3000/api/meta/callback" },
  });
  expect(stolen.status).toBe(400);

  const badOrigin = await request(stopped.base, "/integrations/meta/oauth-url", {
    method: "POST",
    token: owner.token,
    body: { redirectUri: "https://malo.example.com/callback" },
  });
  expect(badOrigin.status).toBe(400);
});
