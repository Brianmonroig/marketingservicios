import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  createUserSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendCodeSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyTwoFactorSchema,
} from "@crm/shared";
import { ZodError } from "zod";
import {
  completeLogin,
  createTeamUser,
  genericAuthCode,
  HttpError,
  listUsers,
  registerAccount,
  requestPasswordReset,
  resendCode,
  resetPassword,
  startLogin,
  verifyEmail,
} from "./accounts.js";
import { createDatabase, type Database } from "./db.js";
import type { Deps } from "./deps.js";
import { requireManager, requireUser } from "./guard.js";
import { processWebhookEvent, sweepWebhookEvents } from "./ingest.js";
import { createMailer, type Mailer } from "./mailer.js";
import { createHttpMetaClient, MetaApiError, type MetaClient } from "./meta.js";
import { sendQueuedMessage } from "./outbound.js";
import { createJobQueue } from "./queues.js";
import { createNoopRealtime, createRedisRealtime } from "./realtime.js";
import { registerCrmRoutes } from "./routes/crm.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";

export type AppOptions = {
  databaseUrl: string;
  mailer?: Mailer;
  meta?: MetaClient;
  // Sin redisUrl no hay colas ni tiempo real: los webhooks responden 503.
  redisUrl?: string;
  queuePrefix?: string;
  // El worker corre dentro del proceso del API porque el plan gratuito de Render no tiene workers.
  runWorkers?: boolean;
};

export async function buildApp(options: AppOptions) {
  const { default: Fastify } = await import("fastify");
  const { db, pool } = createDatabase(options.databaseUrl);
  const mailer = options.mailer ?? createMailer();
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : { level: "info" },
    genReqId: (request) => {
      const header = request.headers["x-request-id"];
      return typeof header === "string" && header.length > 0 ? header : crypto.randomUUID();
    },
  });

  const queue = options.redisUrl ? createJobQueue({ redisUrl: options.redisUrl, prefix: options.queuePrefix }) : null;
  const realtime = options.redisUrl ? createRedisRealtime(options.redisUrl) : createNoopRealtime();
  const deps: Deps = { db, meta: options.meta ?? createHttpMetaClient(), queue, realtime };

  app.decorate("db", db);
  app.decorate("deps", deps);

  let sweeper: NodeJS.Timeout | undefined;
  if (queue && options.runWorkers) {
    queue.startWorkers({
      webhook: (id, final) => processWebhookEvent(deps, id, final),
      send: (data, final) => sendQueuedMessage(deps, data, final),
    });
    if (process.env.NODE_ENV !== "test") {
      sweeper = setInterval(() => {
        void (async () => {
          try {
            const requeued = await sweepWebhookEvents(deps);
            app.log.info({ requeued, queues: await queue.counts() }, "Métricas de colas");
          } catch (error) {
            app.log.warn({ err: error }, "Falló el barrido de eventos pendientes");
          }
        })();
      }, 60_000);
    }
  }

  app.addHook("onClose", async () => {
    if (sweeper) clearInterval(sweeper);
    await queue?.close();
    await realtime.close();
    await pool.end();
  });

  await app.register(cors, {
    origin: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(","),
  });

  if (process.env.NODE_ENV !== "test") {
    await app.register(rateLimit, { global: false });
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.issues[0]?.message ?? "Datos no válidos" });
    }
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: error.message, ...(error.code ? { code: error.code } : {}) });
    }
    if (error instanceof MetaApiError) {
      const status = error.status === 503 ? 503 : error.status === 0 || error.status >= 500 ? 502 : 400;
      return reply.code(status).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Error interno" });
  });

  app.get("/health", async () => ({ ok: true }));

  const authLimit = {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  };

  app.post("/auth/register", authLimit, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    await registerAccount(app.db, mailer, body);
    return reply.code(202).send({ ok: true });
  });

  app.post("/auth/verify-email", authLimit, async (request) => {
    const body = verifyEmailSchema.parse(request.body);
    await verifyEmail(app.db, body);
    return { ok: true };
  });

  app.post("/auth/login", authLimit, async (request) => {
    const body = loginSchema.parse(request.body);
    return startLogin(app.db, mailer, body);
  });

  app.post("/auth/verify-2fa", authLimit, async (request) => {
    const body = verifyTwoFactorSchema.parse(request.body);
    return completeLogin(app.db, body);
  });

  app.post("/auth/resend-code", authLimit, async (request) => {
    const body = resendCodeSchema.parse(request.body);
    await resendCode(app.db, mailer, body);
    return { ok: true };
  });

  app.post("/auth/forgot-password", authLimit, async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);
    await requestPasswordReset(app.db, mailer, body);
    return reply.code(202).send({
      ok: true,
      message: genericAuthCode()
        ? "Si el correo existe, usa el código de prueba abc123 y elige una contraseña nueva."
        : "Si el correo está registrado, te enviamos un código. Revisa la bandeja y el spam.",
    });
  });

  app.post("/auth/reset-password", authLimit, async (request) => {
    const body = resetPasswordSchema.parse(request.body);
    await resetPassword(app.db, body);
    return { ok: true };
  });

  app.get("/auth/me", async (request) => {
    const user = await requireUser(request.headers.authorization);
    return { user };
  });

  app.get("/admin/users", async (request) => {
    const user = await requireManager(request.headers.authorization);
    return { users: await listUsers(app.db, user) };
  });

  app.post("/admin/users", async (request, reply) => {
    const user = await requireManager(request.headers.authorization);
    const body = createUserSchema.parse(request.body);
    await createTeamUser(app.db, mailer, user, body);
    return reply.code(201).send({ ok: true });
  });

  await registerWebhookRoutes(app, deps);
  await registerIntegrationRoutes(app, deps);
  await registerCrmRoutes(app, deps);
  await registerSettingsRoutes(app, deps);

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    deps: Deps;
  }
}
