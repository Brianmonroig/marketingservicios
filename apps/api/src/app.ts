import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  createUserSchema,
  loginSchema,
  registerSchema,
  resendCodeSchema,
  verifyEmailSchema,
  verifyTwoFactorSchema,
} from "@crm/shared";
import { ZodError } from "zod";
import { completeLogin, createTeamUser, HttpError, listUsers, readToken, registerAccount, resendCode, startLogin, verifyEmail } from "./accounts.js";
import { createDatabase, type Database } from "./db.js";
import { createMailer, type Mailer } from "./mailer.js";

export type AppOptions = {
  databaseUrl: string;
  mailer?: Mailer;
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

  app.decorate("db", db);
  app.addHook("onClose", async () => {
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
      return reply.code(error.status).send({ error: error.message });
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

  app.get("/auth/me", async (request) => {
    const user = await requireUser(request.headers.authorization);
    return { user };
  });

  app.get("/admin/users", async (request, reply) => {
    const user = await requireUser(request.headers.authorization);
    if (user.role === "agent") {
      return reply.code(403).send({ error: "No tienes permiso para esta sección" });
    }
    return { users: await listUsers(app.db, user) };
  });

  app.post("/admin/users", async (request, reply) => {
    const user = await requireUser(request.headers.authorization);
    if (user.role === "agent") {
      return reply.code(403).send({ error: "No tienes permiso para esta sección" });
    }
    const body = createUserSchema.parse(request.body);
    await createTeamUser(app.db, mailer, user, body);
    return reply.code(201).send({ ok: true });
  });

  return app;
}

async function requireUser(authorization: string | undefined) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new HttpError("Tienes que entrar para continuar", 401);
  return readToken(token);
}

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}
