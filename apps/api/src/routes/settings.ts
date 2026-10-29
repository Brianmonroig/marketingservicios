import { and, asc, eq, max } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { compare, hash } from "bcryptjs";
import {
  channelCredentialSchema,
  organizationSettingsSchema,
  pipelineStageReorderSchema,
  pipelineStageSchema,
  profileSettingsSchema,
} from "@crm/shared";
import { HttpError } from "../accounts.js";
import { encryptToken } from "../crypto.js";
import { withTenant } from "../db.js";
import type { Deps } from "../deps.js";
import { requireManager, requireUser } from "../guard.js";
import { integrations, pipelineStages, tenants, users } from "../schema.js";

type OrgSettings = Record<string, unknown>;

function asObject(value: unknown): OrgSettings {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as OrgSettings) : {};
}

export async function registerSettingsRoutes(app: FastifyInstance, deps: Deps) {
  app.get("/settings/organization", async (request) => {
    const user = await requireManager(request.headers.authorization);
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
      if (!tenant) throw new HttpError("No encontramos la agencia", 404);
      const settings = asObject(tenant.settings);
      return {
        organization: {
          name: tenant.name,
          plan: tenant.plan,
          companyLegalName: String(settings.companyLegalName ?? ""),
          language: String(settings.language ?? "es"),
          timezone: String(settings.timezone ?? "Europe/Madrid"),
          currency: String(settings.currency ?? "EUR"),
          dateFormat: String(settings.dateFormat ?? "dd/MM/yyyy"),
          jurisdiction: String(settings.jurisdiction ?? "ES"),
          businessHours: settings.businessHours ?? null,
          holidays: Array.isArray(settings.holidays) ? settings.holidays : [],
        },
      };
    });
  });

  app.patch("/settings/organization", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const body = organizationSettingsSchema.parse(request.body);
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
      if (!tenant) throw new HttpError("No encontramos la agencia", 404);
      const current = asObject(tenant.settings);
      const next = {
        ...current,
        ...(body.companyLegalName !== undefined ? { companyLegalName: body.companyLegalName } : {}),
        ...(body.language !== undefined ? { language: body.language } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.dateFormat !== undefined ? { dateFormat: body.dateFormat } : {}),
        ...(body.businessHours !== undefined ? { businessHours: body.businessHours } : {}),
        ...(body.holidays !== undefined ? { holidays: body.holidays } : {}),
      };
      const [updated] = await tx
        .update(tenants)
        .set({
          ...(body.name ? { name: body.name } : {}),
          settings: next,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, user.tenantId))
        .returning();
      return { ok: true, organization: { name: updated.name, ...next } };
    });
  });

  app.get("/settings/profile", async (request) => {
    const user = await requireUser(request.headers.authorization);
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (!row) throw new HttpError("Usuario no encontrado", 404);
      const preferences = asObject(row.preferences);
      return {
        profile: {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          language: String(preferences.language ?? "es"),
          timezone: String(preferences.timezone ?? "Europe/Madrid"),
          notifyEmail: preferences.notifyEmail !== false,
          notifyInbox: preferences.notifyInbox !== false,
        },
      };
    });
  });

  app.patch("/settings/profile", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const body = profileSettingsSchema.parse(request.body);
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (!row) throw new HttpError("Usuario no encontrado", 404);
      if (body.newPassword) {
        if (!body.currentPassword) throw new HttpError("Escribe la contraseña actual", 400);
        const ok = await compare(body.currentPassword, row.passwordHash);
        if (!ok) throw new HttpError("La contraseña actual no es correcta", 401);
      }
      const preferences = {
        ...asObject(row.preferences),
        ...(body.language !== undefined ? { language: body.language } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.notifyEmail !== undefined ? { notifyEmail: body.notifyEmail } : {}),
        ...(body.notifyInbox !== undefined ? { notifyInbox: body.notifyInbox } : {}),
      };
      await tx
        .update(users)
        .set({
          ...(body.name ? { name: body.name } : {}),
          preferences,
          ...(body.newPassword ? { passwordHash: await hash(body.newPassword, 10) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      return { ok: true };
    });
  });

  app.get("/settings/pipelines", async (request) => {
    const user = await requireUser(request.headers.authorization);
    const stages = await withTenant(deps.db, user.tenantId, (tx) =>
      tx
        .select({ id: pipelineStages.id, name: pipelineStages.name, position: pipelineStages.position, kind: pipelineStages.kind })
        .from(pipelineStages)
        .where(eq(pipelineStages.tenantId, user.tenantId))
        .orderBy(asc(pipelineStages.position)),
    );
    return { stages };
  });

  app.post("/settings/pipelines/stages", async (request, reply) => {
    const user = await requireManager(request.headers.authorization);
    const body = pipelineStageSchema.parse(request.body);
    const stage = await withTenant(deps.db, user.tenantId, async (tx) => {
      const [agg] = await tx.select({ value: max(pipelineStages.position) }).from(pipelineStages).where(eq(pipelineStages.tenantId, user.tenantId));
      const position = (agg?.value ?? -1) + 1;
      const [created] = await tx
        .insert(pipelineStages)
        .values({ tenantId: user.tenantId, name: body.name, position, kind: body.kind })
        .returning();
      return created;
    });
    return reply.code(201).send({ stage: { id: stage.id, name: stage.name, position: stage.position, kind: stage.kind } });
  });

  app.patch("/settings/pipelines/stages/:id", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const { id } = request.params as { id: string };
    const body = pipelineStageSchema
      .partial()
      .refine((value) => value.name !== undefined || value.kind !== undefined, { message: "Indica un cambio" })
      .parse(request.body);
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [updated] = await tx
        .update(pipelineStages)
        .set({
          ...(body.name ? { name: body.name } : {}),
          ...(body.kind ? { kind: body.kind } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, user.tenantId)))
        .returning();
      if (!updated) throw new HttpError("La etapa no existe", 404);
      return { stage: { id: updated.id, name: updated.name, position: updated.position, kind: updated.kind } };
    });
  });

  app.put("/settings/pipelines/order", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const body = pipelineStageReorderSchema.parse(request.body);
    await withTenant(deps.db, user.tenantId, async (tx) => {
      for (const [index, id] of body.orderedIds.entries()) {
        await tx
          .update(pipelineStages)
          .set({ position: index, updatedAt: new Date() })
          .where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, user.tenantId)));
      }
    });
    return { ok: true };
  });

  app.get("/settings/credentials", async (request) => {
    const user = await requireManager(request.headers.authorization);
    const rows = await withTenant(deps.db, user.tenantId, (tx) =>
      tx
        .select({
          id: integrations.id,
          provider: integrations.provider,
          status: integrations.status,
          externalAccountId: integrations.externalAccountId,
          metadata: integrations.metadata,
          updatedAt: integrations.updatedAt,
        })
        .from(integrations)
        .where(eq(integrations.tenantId, user.tenantId)),
    );
    // Nunca devolver tokens. Solo flags de configuración.
    return {
      credentials: rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        status: row.status,
        externalAccountId: row.externalAccountId,
        hasSecret: true,
        metadata: sanitizeMeta(row.provider, row.metadata as Record<string, unknown>),
        updatedAt: row.updatedAt,
      })),
      catalog: [
        { provider: "meta_page", label: "Meta · Página (Lead Ads)", configuredVia: "/app/configuracion/integraciones", sendsMessages: false },
        { provider: "whatsapp", label: "WhatsApp Cloud API", configuredVia: "/app/configuracion/integraciones", sendsMessages: true },
        { provider: "telegram", label: "Telegram Bot", configuredVia: "/app/configuracion/credenciales", sendsMessages: false, note: "Solo se guarda el token. Envío real no activado." },
        { provider: "email", label: "Correo (API)", configuredVia: "/app/configuracion/credenciales", sendsMessages: false, note: "Solo se guarda clave y remitente. Envío real no activado." },
        { provider: "google", label: "Google OAuth (client id/secret)", configuredVia: "/app/configuracion/credenciales", sendsMessages: false, note: "Pendiente de flujos OAuth por producto." },
      ],
    };
  });

  app.put("/settings/credentials", async (request, reply) => {
    const user = await requireManager(request.headers.authorization);
    const body = channelCredentialSchema.parse(request.body);

    if (body.provider === "telegram") {
      const saved = await upsertCredential(deps, user.tenantId, {
        provider: "telegram",
        externalAccountId: "bot",
        token: body.botToken,
        metadata: { policyNotes: body.policyNotes ?? "", configured: true, sendsEnabled: false },
      });
      return reply.code(200).send({ ok: true, id: saved.id, provider: "telegram", status: "available" });
    }

    if (body.provider === "email") {
      const saved = await upsertCredential(deps, user.tenantId, {
        provider: "email",
        externalAccountId: body.fromAddress.toLowerCase(),
        token: body.apiKey,
        metadata: {
          fromAddress: body.fromAddress,
          mailProvider: body.mailProvider,
          configured: true,
          sendsEnabled: false,
        },
      });
      return reply.code(200).send({ ok: true, id: saved.id, provider: "email", status: "available" });
    }

    const saved = await upsertCredential(deps, user.tenantId, {
      provider: "google",
      externalAccountId: body.clientId,
      token: body.clientSecret,
      metadata: { clientId: body.clientId, configured: true, oauthReady: false, sendsEnabled: false },
    });
    return reply.code(200).send({ ok: true, id: saved.id, provider: "google", status: "available" });
  });

  app.get("/settings/plan", async (request) => {
    const user = await requireManager(request.headers.authorization);
    return withTenant(deps.db, user.tenantId, async (tx) => {
      const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
      if (!tenant) throw new HttpError("No encontramos la agencia", 404);
      return {
        plan: tenant.plan,
        capabilities: [
          "CRM · Chat WhatsApp",
          "CRM · Contactos y oportunidades",
          "Meta Lead Ads (pendiente de App Review / conexión)",
          "WhatsApp Cloud API (pendiente de número)",
          "Plantillas WhatsApp",
          "Equipo owner/admin/agent",
        ],
        notIncluded: [
          "Facturación / pasarela de pago",
          "Envío real Telegram/correo/Google hasta activación explícita",
          "Automatizaciones y bots",
          "Messenger, Instagram, CAPI, Google Ads",
        ],
      };
    });
  });
}

function sanitizeMeta(provider: string, metadata: Record<string, unknown>) {
  if (provider === "email") {
    return { fromAddress: metadata.fromAddress ?? null, mailProvider: metadata.mailProvider ?? null, sendsEnabled: false };
  }
  if (provider === "telegram") {
    return { policyNotes: metadata.policyNotes ?? "", sendsEnabled: false };
  }
  if (provider === "google") {
    return { clientId: metadata.clientId ?? null, oauthReady: false, sendsEnabled: false };
  }
  return { name: metadata.name ?? null };
}

async function upsertCredential(
  deps: Deps,
  tenantId: string,
  input: { provider: string; externalAccountId: string; token: string; metadata: Record<string, unknown> },
) {
  return withTenant(deps.db, tenantId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, input.provider)))
      .limit(1);
    if (existing) {
      const [updated] = await tx
        .update(integrations)
        .set({
          externalAccountId: input.externalAccountId,
          accessTokenEncrypted: encryptToken(input.token),
          status: "available",
          metadata: input.metadata,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(integrations)
      .values({
        tenantId,
        provider: input.provider,
        externalAccountId: input.externalAccountId,
        accessTokenEncrypted: encryptToken(input.token),
        status: "available",
        metadata: input.metadata,
      })
      .returning();
    return created;
  });
}
