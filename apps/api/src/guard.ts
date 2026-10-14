import type { PublicUser } from "@crm/shared";
import { HttpError, readToken } from "./accounts.js";

export async function requireUser(authorization: string | undefined): Promise<PublicUser> {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new HttpError("Tienes que entrar para continuar", 401);
  return readToken(token);
}

// Dueños y administradores. Un agente recibe 403.
export async function requireManager(authorization: string | undefined): Promise<PublicUser> {
  const user = await requireUser(authorization);
  if (user.role === "agent") throw new HttpError("No tienes permiso para esta sección", 403);
  return user;
}
