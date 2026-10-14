import { createHmac, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { lastCode } from "../src/mailer.mock-store.js";
import { createMockMailer } from "../src/mailer.mock.js";
import { createMetaMock, type MetaMock } from "../src/meta.mock.js";

export const databaseUrl = process.env.DATABASE_URL as string;
export const migrateUrl = (process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL) as string;
export const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
export const APP_SECRET = "test-app-secret";
export const VERIFY_TOKEN = "test-verify-token";

export function prepareEnv() {
  process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret";
  process.env.TOKEN_ENCRYPTION_KEY ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
  process.env.NODE_ENV = "test";
  process.env.META_APP_ID = "123456789";
  process.env.META_APP_SECRET = APP_SECRET;
  process.env.META_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
  process.env.WEB_ORIGIN = "http://localhost:3000";
  process.env.QUEUE_BACKOFF_MS = "100";
}

export type Running = { app: FastifyInstance; base: string; meta: MetaMock };

export async function startApp(options: { prefix: string; workers: boolean; meta?: MetaMock }): Promise<Running> {
  if (!databaseUrl) throw new Error("Falta DATABASE_URL");
  const meta = options.meta ?? createMetaMock();
  const app = await buildApp({
    databaseUrl,
    mailer: createMockMailer(),
    meta,
    redisUrl,
    queuePrefix: options.prefix,
    runWorkers: options.workers,
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address() as AddressInfo;
  return { app, base: `http://127.0.0.1:${address.port}`, meta };
}

export async function request(
  base: string,
  path: string,
  init: { method?: string; token?: string; body?: unknown; headers?: Record<string, string>; rawBody?: string } = {},
) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined || init.rawBody !== undefined) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  const response = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = { text };
  }
  return { status: response.status, data };
}

export function sign(body: string, secret = APP_SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export async function postSigned(base: string, path: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  return request(base, path, { method: "POST", rawBody: raw, headers: { "x-hub-signature-256": sign(raw) } });
}

export type Tenant = { token: string; email: string; tenantId: string };

export async function createTenant(base: string, label: string): Promise<Tenant> {
  const email = `${label}-${randomUUID()}@example.com`;
  const registered = await request(base, "/auth/register", {
    method: "POST",
    body: { agencyName: `Agencia ${label}`, name: "Ana Dueña", email, password: "clave-segura" },
  });
  if (registered.status !== 202) throw new Error(`Registro falló: ${JSON.stringify(registered.data)}`);
  await request(base, "/auth/verify-email", { method: "POST", body: { email, code: lastCode(email, "verify_email") } });
  const login = await request(base, "/auth/login", { method: "POST", body: { email, password: "clave-segura" } });
  const session = await request(base, "/auth/verify-2fa", {
    method: "POST",
    body: { email, challengeId: login.data.challengeId, code: lastCode(email, "login_2fa") },
  });
  const user = session.data.user as { tenantId: string };
  return { token: session.data.token as string, email, tenantId: user.tenantId };
}

export async function waitFor<T>(check: () => Promise<T | null | undefined | false>, timeoutMs = 10_000, everyMs = 100): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("Se agotó la espera");
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}

// Conexión con permisos de administrador solo para preparar y comprobar datos en los tests.
export function adminPool() {
  return new pg.Pool({ connectionString: migrateUrl });
}

// Ids numéricos únicos por ejecución: evita choques con datos de ejecuciones anteriores.
export function uniqueDigits(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export async function connectWhatsApp(base: string, token: string, phoneNumberId = uniqueDigits(), wabaId = uniqueDigits()) {
  const response = await request(base, "/integrations/whatsapp", {
    method: "POST",
    token,
    body: { phoneNumberId, wabaId, accessToken: "token-de-whatsapp-con-mas-de-veinte-caracteres" },
  });
  if (response.status !== 201) throw new Error(`No se pudo conectar WhatsApp: ${JSON.stringify(response.data)}`);
  return { phoneNumberId, wabaId };
}

export function whatsappMessagePayload(input: { phoneNumberId: string; from: string; id: string; text: string; name?: string; timestamp?: number }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "9998887776",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "34600000000", phone_number_id: input.phoneNumberId },
              contacts: [{ profile: { name: input.name ?? "Carlos Fontanero" }, wa_id: input.from }],
              messages: [
                {
                  from: input.from,
                  id: input.id,
                  timestamp: String(input.timestamp ?? Math.floor(Date.now() / 1000)),
                  text: { body: input.text },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function whatsappStatusPayload(input: { phoneNumberId: string; id: string; status: string; recipient: string }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "9998887776",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "34600000000", phone_number_id: input.phoneNumberId },
              statuses: [{ id: input.id, status: input.status, timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: input.recipient }],
            },
          },
        ],
      },
    ],
  };
}

export function leadgenPayload(input: { pageId: string; leadgenId: string; formId?: string }) {
  return {
    object: "page",
    entry: [
      {
        id: input.pageId,
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field: "leadgen",
            value: {
              ad_id: "ad-1",
              form_id: input.formId ?? "form-1",
              leadgen_id: input.leadgenId,
              created_time: Math.floor(Date.now() / 1000),
              page_id: input.pageId,
              adgroup_id: "adset-1",
            },
          },
        ],
      },
    ],
  };
}

export async function connectPage(base: string, token: string, meta: MetaMock, pageId: string, pageName = "Fontanería Norte") {
  meta.pages = [{ id: pageId, name: pageName, accessToken: `token-pagina-${pageId}` }];
  const urlResponse = await request(base, "/integrations/meta/oauth-url", {
    method: "POST",
    token,
    body: { redirectUri: "http://localhost:3000/api/meta/callback" },
  });
  const state = new URL(urlResponse.data.url as string).searchParams.get("state") as string;
  const exchanged = await request(base, "/integrations/meta/oauth-exchange", {
    method: "POST",
    token,
    body: { code: "codigo-valido", state, redirectUri: "http://localhost:3000/api/meta/callback" },
  });
  const list = exchanged.data.integrations as Array<{ id: string; externalAccountId: string }>;
  const page = list.find((item) => item.externalAccountId === pageId);
  if (!page) throw new Error(`La página no aparece: ${JSON.stringify(exchanged.data)}`);
  const activated = await request(base, `/integrations/${page.id}/activate`, { method: "POST", token });
  return { integrationId: page.id, activated };
}
