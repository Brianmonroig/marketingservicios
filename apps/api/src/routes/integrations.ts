import { and, eq, ne } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { FastifyInstance } from "fastify";
import { metaOAuthExchangeSchema, metaOAuthUrlSchema, whatsappConnectSchema } from "@crm/shared";
import { HttpError } from "../accounts.js";
import { decryptToken, encryptToken } from "../crypto.js";
import { withTenant } from "../db.js";
import type { Deps } from "../deps.js";
import { requireManager } from "../guard.js";
import { metaConfig } from "../meta.js";
import { integrations } from "../schema.js";

function allowedOrigins(): string[] {
  return (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",").map((value) => value.trim());
}

function assertRedirectAllowed(redirectUri: string) {
  const origin = new URL(redirectUri).origin;
  if (!allowedOrigins().includes(origin)) {
    throw new HttpError("La dirección de retorno no pertenece a esta aplicación", 400);
  }
}

function stateKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET");
  return new TextEncoder().encode(secret);
}

async function signState(tenantId: string, userId: string): Promise<string> {
  return new SignJWT({ purpose: "meta_oauth", tenantId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime("10m")
    .sign(stateKey());
}

async function checkState(state: string, tenantId: string, userId: string) {
  try {
    const { payload } = await jwtVerify(state, stateKey());
    if (payload.purpose === "meta_oauth" && payload.tenantId === tenantId && payload.sub === userId) return;
  } catch {
    // cae al error de abajo
  }
  throw new HttpError("El permiso de Facebook caducó o no es de tu sesión. Vuelve a empezar.", 400);
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

type PublicIntegration = {
  id: string;
  provider: string;
  externalAccountId: string;
  status: string;
  name: string | null;
  tokenExpiresAt: Date | null;
  metadata: Record<string, unknown>;
};

function toPublic(row: typeof integrations.$inferSelect): PublicIntegration {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    provider: row.provider,
    externalAccountId: row.externalAccountId,
    status: row.status,
    name: typeof metadata.name === "string" ? metadata.name : typeof metadata.displayPhoneNumber === "string" ? metadata.displayPhoneNumber : null,
    tokenExpiresAt: row.tokenExpiresAt,
    metadata,
  };
}

export async function registerIntegrationRoutes(app: FastifyInstance, deps: Deps) {
  // Qué falta configurar en el servidor. Solo dice sí o no, nunca los valores.
  app.get("/integrations/setup", async (request) => {
    await requireManager(request.headers.authorization);
    const config = metaConfig();
    return {
      metaApp: Boolean(config.appId && config.appSecret),
      webhookVerifyToken: Boolean(config.verifyToken),
      queue: deps.queue !== null,
      graphVersion: config.version,
    };
  });

  app.get("/integrations", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const rows = await withTenant(deps.db, user.tenantId, (tx) =>
      tx.select().from(integrations).where(eq(integrations.tenantId, user.tenantId)),
    );
    // Los tokens no salen nunca de la API.
    return { integrations: rows.map(toPublic) };
  });

  app.post("/integrations/meta/oauth-url", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const { redirectUri } = metaOAuthUrlSchema.parse(request.body);
    assertRedirectAllowed(redirectUri);
    const state = await signState(user.tenantId, user.id);
    return { url: deps.meta.buildOAuthUrl({ redirectUri, state }) };
  });

  app.post("/integrations/meta/oauth-exchange", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const body = metaOAuthExchangeSchema.parse(request.body);
    assertRedirectAllowed(body.redirectUri);
    await checkState(body.state, user.tenantId, user.id);

    const userToken = await deps.meta.exchangeCodeForLongLivedToken({ code: body.code, redirectUri: body.redirectUri });
    const pages = await deps.meta.listPages(userToken.accessToken);

    await withTenant(deps.db, user.tenantId, async (tx) => {
      for (const page of pages) {
        const encrypted = encryptToken(page.accessToken);
        const existing = await tx
          .select({ id: integrations.id, status: integrations.status })
          .from(integrations)
          .where(and(eq(integrations.provider, "meta_page"), eq(integrations.externalAccountId, page.id)))
          .limit(1);
        if (existing[0]) {
          await tx
            .update(integrations)
            .set({
              accessTokenEncrypted: encrypted,
              metadata: { name: page.name },
              status: existing[0].status === "active" ? "active" : "available",
            })
            .where(eq(integrations.id, existing[0].id));
        } else {
          await tx.insert(integrations).values({
            tenantId: user.tenantId,
            provider: "meta_page",
            externalAccountId: page.id,
            accessTokenEncrypted: encrypted,
            tokenExpiresAt: null,
            status: "available",
            metadata: { name: page.name },
          });
        }
      }
    });

    const rows = await withTenant(deps.db, user.tenantId, (tx) =>
      tx.select().from(integrations).where(and(eq(integrations.tenantId, user.tenantId), eq(integrations.provider, "meta_page"))),
    );
    return { integrations: rows.map(toPublic), pagesFound: pages.length };
  });

  // Suscribe la app a los eventos "leadgen" de la página y la marca como activa.
  app.post("/integrations/:id/activate", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const { id } = request.params as { id: string };
    try {
      await withTenant(deps.db, user.tenantId, async (tx) => {
        const [row] = await tx
          .select()
          .from(integrations)
          .where(and(eq(integrations.id, id), eq(integrations.provider, "meta_page")))
          .limit(1);
        if (!row) throw new HttpError("La página no existe", 404);
        await tx.update(integrations).set({ status: "active" }).where(eq(integrations.id, id));
        await deps.meta.subscribePage(row.externalAccountId, decryptToken(row.accessTokenEncrypted));
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError("Esa página ya está conectada en otra agencia", 409);
      }
      throw error;
    }
    return { ok: true };
  });

  app.delete("/integrations/:id", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const { id } = request.params as { id: string };
    const row = await withTenant(deps.db, user.tenantId, async (tx) => {
      const [found] = await tx.select().from(integrations).where(eq(integrations.id, id)).limit(1);
      if (!found) throw new HttpError("La conexión no existe", 404);
      await tx.delete(integrations).where(eq(integrations.id, id));
      return found;
    });
    if (row.provider === "meta_page" && row.status === "active") {
      try {
        await deps.meta.unsubscribePage(row.externalAccountId, decryptToken(row.accessTokenEncrypted));
      } catch (error) {
        request.log.warn({ err: error }, "No se pudo quitar la suscripción de la página en Meta");
      }
    }
    return { ok: true };
  });

  // Conexión manual del número: Meta confirma que el token y el número son válidos.
  app.post("/integrations/whatsapp", async (request, reply) => {
    const user = await requireManager(request.headers.authorization);
    const body = whatsappConnectSchema.parse(request.body);
    const phone = await deps.meta.getPhoneNumber(body.phoneNumberId, body.accessToken);
    try {
      await withTenant(deps.db, user.tenantId, async (tx) => {
        const other = await tx
          .select({ id: integrations.id })
          .from(integrations)
          .where(
            and(
              eq(integrations.provider, "whatsapp"),
              eq(integrations.status, "active"),
              ne(integrations.externalAccountId, body.phoneNumberId),
            ),
          )
          .limit(1);
        if (other[0]) throw new HttpError("Ya hay otro número conectado. Desconéctalo antes de añadir este.", 409);

        const values = {
          accessTokenEncrypted: encryptToken(body.accessToken),
          status: "active",
          tokenExpiresAt: null,
          metadata: {
            wabaId: body.wabaId,
            displayPhoneNumber: phone.displayPhoneNumber,
            verifiedName: phone.verifiedName ?? null,
          },
        };
        const [existing] = await tx
          .select({ id: integrations.id })
          .from(integrations)
          .where(and(eq(integrations.provider, "whatsapp"), eq(integrations.externalAccountId, body.phoneNumberId)))
          .limit(1);
        if (existing) {
          await tx.update(integrations).set(values).where(eq(integrations.id, existing.id));
        } else {
          await tx.insert(integrations).values({
            tenantId: user.tenantId,
            provider: "whatsapp",
            externalAccountId: body.phoneNumberId,
            ...values,
          });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new HttpError("Ese número ya está conectado en otra agencia", 409);
      throw error;
    }
    return reply.code(201).send({ ok: true, displayPhoneNumber: phone.displayPhoneNumber });
  });
}
