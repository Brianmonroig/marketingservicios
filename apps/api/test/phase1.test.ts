import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";
import { lastCode, sentMessages } from "../src/mailer.mock-store.js";
import { createMockMailer } from "../src/mailer.mock.js";
import type { FastifyInstance } from "fastify";

const databaseUrl = process.env.DATABASE_URL;
const migrateUrl = process.env.DATABASE_MIGRATE_URL ?? databaseUrl;

function vectorLiteral(): string {
  return `[${Array.from({ length: 1536 }, () => "0.01").join(",")}]`;
}

beforeAll(() => {
  process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret";
  process.env.TOKEN_ENCRYPTION_KEY ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
  process.env.NODE_ENV = "test";
  sentMessages.length = 0;
});

async function listen(app: FastifyInstance) {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function request(base: string, path: string, init: { method: string; token?: string; body?: unknown }) {
  const headers = new Headers();
  if (init.body) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  const response = await fetch(`${base}${path}`, {
    method: init.method,
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, data };
}

test("un agente no entra a la sección de administración", async () => {
  if (!databaseUrl) throw new Error("Falta DATABASE_URL");
  const app = await buildApp({ databaseUrl, mailer: createMockMailer() });
  const base = await listen(app);
  const ownerEmail = `owner-${randomUUID()}@example.com`;
  const agentEmail = `agent-${randomUUID()}@example.com`;

  const registered = await request(base, "/auth/register", {
    method: "POST",
    body: {
      agencyName: "Agencia Norte",
      name: "Ana Dueña",
      email: ownerEmail,
      password: "clave-segura",
    },
  });
  expect(registered.status).toBe(202);

  const verified = await request(base, "/auth/verify-email", {
    method: "POST",
    body: { email: ownerEmail, code: lastCode(ownerEmail, "verify_email") },
  });
  expect(verified.status).toBe(200);

  const login = await request(base, "/auth/login", {
    method: "POST",
    body: { email: ownerEmail, password: "clave-segura" },
  });
  expect(login.status).toBe(200);
  const session = await request(base, "/auth/verify-2fa", {
    method: "POST",
    body: { email: ownerEmail, challengeId: login.data.challengeId, code: lastCode(ownerEmail, "login_2fa") },
  });
  expect(session.status).toBe(200);
  const ownerToken = session.data.token as string;

  const created = await request(base, "/admin/users", {
    method: "POST",
    token: ownerToken,
    body: {
      name: "Luis Agente",
      email: agentEmail,
      password: "clave-segura",
      role: "agent",
    },
  });
  expect(created.status).toBe(201);

  await request(base, "/auth/verify-email", {
    method: "POST",
    body: { email: agentEmail, code: lastCode(agentEmail, "verify_email") },
  });
  const agentLogin = await request(base, "/auth/login", {
    method: "POST",
    body: { email: agentEmail, password: "clave-segura" },
  });
  const agentSession = await request(base, "/auth/verify-2fa", {
    method: "POST",
    body: {
      email: agentEmail,
      challengeId: agentLogin.data.challengeId,
      code: lastCode(agentEmail, "login_2fa"),
    },
  });
  const agentToken = agentSession.data.token as string;

  const forbidden = await request(base, "/admin/users", { method: "GET", token: agentToken });
  expect(forbidden.status).toBe(403);

  const allowed = await request(base, "/admin/users", { method: "GET", token: ownerToken });
  expect(allowed.status).toBe(200);
  expect(allowed.data.users).toHaveLength(2);

  await app.close();
});

test("un tenant no lee chunks ni leads de otro, ni por API ni por SQL", async () => {
  if (!databaseUrl || !migrateUrl) throw new Error("Falta DATABASE_URL");
  const app = await buildApp({ databaseUrl, mailer: createMockMailer() });
  const base = await listen(app);
  const emailA = `a-${randomUUID()}@example.com`;
  const emailB = `b-${randomUUID()}@example.com`;

  async function openTenant(email: string, agencyName: string) {
    await request(base, "/auth/register", {
      method: "POST",
      body: { agencyName, name: agencyName, email, password: "clave-segura" },
    });
    await request(base, "/auth/verify-email", {
      method: "POST",
      body: { email, code: lastCode(email, "verify_email") },
    });
    const login = await request(base, "/auth/login", {
      method: "POST",
      body: { email, password: "clave-segura" },
    });
    const session = await request(base, "/auth/verify-2fa", {
      method: "POST",
      body: { email, challengeId: login.data.challengeId, code: lastCode(email, "login_2fa") },
    });
    return session.data as { token: string; user: { id: string; tenantId: string } };
  }

  const tenantA = await openTenant(emailA, "Agencia A");
  const tenantB = await openTenant(emailB, "Agencia B");

  const admin = new pg.Client({ connectionString: databaseUrl });
  await admin.connect();
  try {
    async function insertChunk(tenantId: string, userId: string, content: string) {
      await admin.query("BEGIN");
      await admin.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const document = await admin.query(
        `INSERT INTO documents (tenant_id, filename, file_type, storage_key, status, uploaded_by)
         VALUES ($1, 'oferta.pdf', 'application/pdf', $2, 'ready', $3)
         RETURNING id`,
        [tenantId, `${tenantId}.pdf`, userId],
      );
      await admin.query(
        `INSERT INTO document_chunks
           (tenant_id, document_id, content, embedding, embedding_model, embedding_dim, chunk_index)
         VALUES ($1, $2, $3, $4::vector, 'text-embedding-3-small', 1536, 0)`,
        [tenantId, document.rows[0].id, content, vectorLiteral()],
      );
      await admin.query(
        `INSERT INTO leads (tenant_id, name, source, whatsapp_opt_in)
         VALUES ($1, $2, 'manual', false)`,
        [tenantId, content],
      );
      await admin.query("COMMIT");
    }

    await insertChunk(tenantA.user.tenantId, tenantA.user.id, "secreto de A");
    await insertChunk(tenantB.user.tenantId, tenantB.user.id, "secreto de B");

    await admin.query("BEGIN");
    await admin.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA.user.tenantId]);
    const chunks = await admin.query("SELECT content FROM document_chunks ORDER BY content");
    const leads = await admin.query("SELECT name FROM leads ORDER BY name");
    const users = await admin.query("SELECT email FROM users ORDER BY email");
    await admin.query("COMMIT");

    expect(chunks.rows.map((row) => row.content)).toEqual(["secreto de A"]);
    expect(leads.rows.map((row) => row.name)).toEqual(["secreto de A"]);
    expect(users.rows.map((row) => row.email)).toEqual([emailA]);

    await admin.query("BEGIN");
    const hidden = await admin.query("SELECT content FROM document_chunks");
    await admin.query("COMMIT");
    expect(hidden.rows).toEqual([]);
  } finally {
    await admin.end();
  }

  const listA = await request(base, "/admin/users", { method: "GET", token: tenantA.token });
  const emails = (listA.data.users as Array<{ email: string }>).map((user) => user.email);
  expect(emails).toEqual([emailA]);
  expect(emails).not.toContain(emailB);

  await app.close();
});
