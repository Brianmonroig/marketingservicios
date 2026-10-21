import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { and, desc, eq, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import {
  defaultPipelineStages,
  type PublicUser,
  type Role,
} from "@crm/shared";
import { codeExpiresAt, codesMatch, createNumericCode, hashCode } from "./crypto.js";
import { withTenant, type Database, type Transaction } from "./db.js";
import type { Mailer, MailPurpose } from "./mailer.js";
import { emailChallenges, pipelineStages, tenants, users } from "./schema.js";
import { sql } from "drizzle-orm";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

type SessionUser = PublicUser & { passwordHash?: never };

function pepper(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("Falta JWT_SECRET");
  return value;
}

function jwtKey(): Uint8Array {
  return new TextEncoder().encode(pepper());
}

async function issueToken(user: PublicUser): Promise<string> {
  return new SignJWT({
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
    name: user.name,
    agencyName: user.agencyName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(jwtKey());
}

export async function readToken(token: string): Promise<PublicUser> {
  try {
    const { payload } = await jwtVerify(token, jwtKey());
    const role = payload.role;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.tenantId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.agencyName !== "string" ||
      (role !== "owner" && role !== "admin" && role !== "agent")
    ) {
      throw new HttpError("La sesión no es válida", 401);
    }
    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      agencyName: payload.agencyName,
      name: payload.name,
      email: payload.email,
      role,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("La sesión no es válida", 401);
  }
}

async function findUserByEmail(db: Database, email: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.auth_email', ${email}, true)`);
    await tx.execute(sql`select set_config('app.tenant_id', '', true)`);
    const [user] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  });
}

async function agencyName(tx: Transaction, tenantId: string): Promise<string> {
  const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new HttpError("No encontramos la agencia", 404);
  return tenant.name;
}

async function storeCode(tx: Transaction, input: { tenantId: string; userId: string; purpose: MailPurpose; code: string }) {
  const challengeId = randomUUID();
  await tx
    .update(emailChallenges)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(emailChallenges.userId, input.userId),
        eq(emailChallenges.purpose, input.purpose),
        isNull(emailChallenges.consumedAt),
      ),
    );
  await tx.insert(emailChallenges).values({
    id: challengeId,
    tenantId: input.tenantId,
    userId: input.userId,
    purpose: input.purpose,
    codeHash: hashCode(input.code, pepper()),
    expiresAt: codeExpiresAt(),
  });
  return challengeId;
}

function normalizeAuthCode(code: string): string {
  return code.replace(/\s+/g, "").toLowerCase();
}

/** Código fijo de acceso (AUTH_GENERIC_CODE). Pensado para arrancar sin servicio de correo. */
export function genericAuthCode(): string | null {
  const raw = process.env.AUTH_GENERIC_CODE?.trim();
  if (!raw) return null;
  return normalizeAuthCode(raw);
}

function matchesGenericCode(code: string): boolean {
  const expected = genericAuthCode();
  return expected !== null && normalizeAuthCode(code) === expected;
}

async function sendCode(mailer: Mailer, input: { to: string; code: string; purpose: MailPurpose }) {
  // Con código genérico no hace falta correo: el usuario usa AUTH_GENERIC_CODE.
  if (genericAuthCode()) {
    console.info(`[auth] código genérico activo; no se envía correo (${input.purpose} → ${input.to})`);
    return;
  }
  try {
    await mailer.sendVerificationCode(input);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error desconocido";
    throw new HttpError(`No pudimos enviar el código al correo. ${detail}`, 503);
  }
}

function toPublic(user: { id: string; tenantId: string; name: string; email: string; role: string }, name: string): PublicUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    agencyName: name,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  };
}

export async function registerAccount(
  db: Database,
  mailer: Mailer,
  input: { agencyName: string; name: string; email: string; password: string },
): Promise<void> {
  const existing = await findUserByEmail(db, input.email);
  if (existing) throw new HttpError("Ese correo ya está registrado", 409);

  const tenantId = randomUUID();
  const userId = randomUUID();
  const code = createNumericCode();
  const passwordHash = await hash(input.password, 10);

  await withTenant(db, tenantId, async (tx) => {
    await tx.insert(tenants).values({
      id: tenantId,
      name: input.agencyName,
      plan: "trial",
      settings: {
        language: "es",
        jurisdiction: "ES",
        timezone: "Europe/Madrid",
        llmProvider: null,
        llmModel: null,
      },
    });
    await tx.insert(users).values({
      id: userId,
      tenantId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: "owner",
    });
    await tx.insert(pipelineStages).values(
      defaultPipelineStages.map((name, position) => ({
        tenantId,
        name,
        position,
      })),
    );
    await storeCode(tx, { tenantId, userId, purpose: "verify_email", code });
  });

  await sendCode(mailer, { to: input.email, code, purpose: "verify_email" });
}

async function consumeCode(tx: Transaction, input: { userId: string; purpose: MailPurpose; code: string }) {
  const [challenge] = await tx
    .select()
    .from(emailChallenges)
    .where(
      and(
        eq(emailChallenges.userId, input.userId),
        eq(emailChallenges.purpose, input.purpose),
        isNull(emailChallenges.consumedAt),
      ),
    )
    .orderBy(desc(emailChallenges.createdAt))
    .limit(1);

  if (matchesGenericCode(input.code)) {
    if (challenge) {
      await tx.update(emailChallenges).set({ consumedAt: new Date() }).where(eq(emailChallenges.id, challenge.id));
      return challenge.id;
    }
    return "generic";
  }

  if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
    throw new HttpError("El código es incorrecto o ya caducó", 401);
  }
  const matches = codesMatch(challenge.codeHash, hashCode(input.code, pepper()));
  if (!matches) throw new HttpError("El código es incorrecto o ya caducó", 401);

  await tx.update(emailChallenges).set({ consumedAt: new Date() }).where(eq(emailChallenges.id, challenge.id));
  return challenge.id;
}

export async function verifyEmail(db: Database, input: { email: string; code: string }): Promise<void> {
  const user = await findUserByEmail(db, input.email);
  if (!user) throw new HttpError("El código es incorrecto o ya caducó", 401);
  await withTenant(db, user.tenantId, async (tx) => {
    await consumeCode(tx, { userId: user.id, purpose: "verify_email", code: input.code });
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  });
}

export async function startLogin(
  db: Database,
  mailer: Mailer,
  input: { email: string; password: string },
): Promise<{ challengeId: string }> {
  const user = await findUserByEmail(db, input.email);
  if (!user) throw new HttpError("Correo o contraseña incorrectos", 401);
  const passwordOk = await compare(input.password, user.passwordHash);
  if (!passwordOk) throw new HttpError("Correo o contraseña incorrectos", 401);
  if (!user.emailVerifiedAt) {
    throw new HttpError(
      genericAuthCode()
        ? "Primero confirma el correo en /verificar con el código de prueba abc123"
        : "Primero confirma el correo con el código que te enviamos",
      403,
    );
  }

  const code = createNumericCode();
  const challengeId = await withTenant(db, user.tenantId, async (tx) =>
    storeCode(tx, { tenantId: user.tenantId, userId: user.id, purpose: "login_2fa", code }),
  );
  await sendCode(mailer, { to: user.email, code, purpose: "login_2fa" });
  return { challengeId };
}

export async function completeLogin(
  db: Database,
  input: { email: string; challengeId: string; code: string },
): Promise<{ token: string; user: PublicUser }> {
  const user = await findUserByEmail(db, input.email);
  if (!user || !user.emailVerifiedAt) throw new HttpError("El código es incorrecto o ya caducó", 401);

  const publicUser = await withTenant(db, user.tenantId, async (tx) => {
    const [challenge] = await tx
      .select()
      .from(emailChallenges)
      .where(and(eq(emailChallenges.id, input.challengeId), eq(emailChallenges.userId, user.id)))
      .limit(1);
    if (!challenge || challenge.purpose !== "login_2fa" || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
      throw new HttpError("El código es incorrecto o ya caducó", 401);
    }
    const ok =
      matchesGenericCode(input.code) || codesMatch(challenge.codeHash, hashCode(input.code, pepper()));
    if (!ok) throw new HttpError("El código es incorrecto o ya caducó", 401);
    await tx.update(emailChallenges).set({ consumedAt: new Date() }).where(eq(emailChallenges.id, challenge.id));
    const name = await agencyName(tx, user.tenantId);
    return toPublic(user, name);
  });

  return { token: await issueToken(publicUser), user: publicUser };
}

export async function resendCode(
  db: Database,
  mailer: Mailer,
  input: { email: string; purpose: MailPurpose },
): Promise<void> {
  const user = await findUserByEmail(db, input.email);
  if (!user) return;
  if (input.purpose === "login_2fa" && !user.emailVerifiedAt) return;
  if (input.purpose === "verify_email" && user.emailVerifiedAt) return;
  const code = createNumericCode();
  await withTenant(db, user.tenantId, async (tx) => {
    await storeCode(tx, { tenantId: user.tenantId, userId: user.id, purpose: input.purpose, code });
  });
  await sendCode(mailer, { to: user.email, code, purpose: input.purpose });
}

/** Siempre responde igual: no revela si el correo existe. */
export async function requestPasswordReset(
  db: Database,
  mailer: Mailer,
  input: { email: string },
): Promise<void> {
  const user = await findUserByEmail(db, input.email);
  if (!user) return;
  const code = createNumericCode();
  await withTenant(db, user.tenantId, async (tx) => {
    await storeCode(tx, { tenantId: user.tenantId, userId: user.id, purpose: "password_reset", code });
  });
  await sendCode(mailer, { to: user.email, code, purpose: "password_reset" });
}

export async function resetPassword(
  db: Database,
  input: { email: string; code: string; password: string },
): Promise<void> {
  const user = await findUserByEmail(db, input.email);
  if (!user) throw new HttpError("El código es incorrecto o ya caducó", 401);
  const passwordHash = await hash(input.password, 10);
  await withTenant(db, user.tenantId, async (tx) => {
    await consumeCode(tx, { userId: user.id, purpose: "password_reset", code: input.code });
    await tx
      .update(users)
      .set({
        passwordHash,
        // Si aún no había confirmado el correo, al resetear con el código queda confirmado.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  });
}

export async function listUsers(db: Database, actor: PublicUser): Promise<PublicUser[]> {
  return withTenant(db, actor.tenantId, async (tx) => {
    const name = await agencyName(tx, actor.tenantId);
    const rows = await tx.select().from(users).orderBy(users.createdAt);
    return rows.map((user) => toPublic(user, name));
  });
}

export async function createTeamUser(
  db: Database,
  mailer: Mailer,
  actor: PublicUser,
  input: { name: string; email: string; password: string; role: "admin" | "agent" },
): Promise<void> {
  if (actor.role === "agent") throw new HttpError("No tienes permiso para esta sección", 403);
  if (actor.role === "admin" && input.role !== "agent") {
    throw new HttpError("Un administrador solo puede crear agentes", 403);
  }
  const existing = await findUserByEmail(db, input.email);
  if (existing) throw new HttpError("Ese correo ya está registrado", 409);

  const code = createNumericCode();
  const passwordHash = await hash(input.password, 10);
  await withTenant(db, actor.tenantId, async (tx) => {
    const userId = randomUUID();
    await tx.insert(users).values({
      id: userId,
      tenantId: actor.tenantId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });
    await storeCode(tx, { tenantId: actor.tenantId, userId, purpose: "verify_email", code });
  });
  await sendCode(mailer, { to: input.email, code, purpose: "verify_email" });
}
