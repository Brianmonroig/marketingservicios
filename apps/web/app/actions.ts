"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { requiredEnv } from "@/lib/env";

const pendingCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 10,
};

type FormState = { error?: string };
type TeamState = { error?: string; ok?: boolean };

async function post(path: string, body: unknown) {
  const response = await fetch(`${requiredEnv("API_URL")}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; challengeId?: string };
  if (!response.ok) return { error: data.error ?? "No se pudo completar la acción" };
  return data;
}

export async function registerAction(_state: FormState, formData: FormData): Promise<FormState> {
  const result = await post("/auth/register", {
    agencyName: formData.get("agencyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (result.error) return { error: result.error };
  const jar = await cookies();
  jar.set("crm_pending_verify", String(formData.get("email") ?? "").trim().toLowerCase(), pendingCookie);
  redirect("/verificar");
}

export async function verifyEmailAction(_state: FormState, formData: FormData): Promise<FormState> {
  const jar = await cookies();
  const email = jar.get("crm_pending_verify")?.value ?? "";
  const result = await post("/auth/verify-email", { email, code: formData.get("code") });
  if (result.error) return { error: result.error };
  jar.delete("crm_pending_verify");
  redirect("/login?confirmado=1");
}

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const result = await post("/auth/login", { email, password: formData.get("password") });
  if (result.error || !result.challengeId) return { error: result.error ?? "No se pudo entrar" };
  const jar = await cookies();
  jar.set("crm_pending_2fa", JSON.stringify({ email, challengeId: result.challengeId }), pendingCookie);
  redirect("/login/codigo");
}

export async function verifyTwoFactorAction(_state: FormState, formData: FormData): Promise<FormState> {
  const jar = await cookies();
  const raw = jar.get("crm_pending_2fa")?.value;
  if (!raw) return { error: "El intento de entrada caducó. Vuelve a escribir tu contraseña." };
  const pending = JSON.parse(raw) as { email: string; challengeId: string };
  try {
    await signIn("credentials", {
      email: pending.email,
      challengeId: pending.challengeId,
      code: String(formData.get("code") ?? ""),
      redirectTo: "/app",
    });
  } catch (error) {
    if (isRedirect(error)) {
      jar.delete("crm_pending_2fa");
      throw error;
    }
    return { error: "El código es incorrecto o ya caducó" };
  }
  return {};
}

export async function createTeamMemberAction(_state: TeamState, formData: FormData): Promise<TeamState> {
  const { apiFetch } = await import("@/lib/api");
  const result = await apiFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
    }),
  });
  if (!result.ok) return { error: result.data.error ?? "No se pudo crear la persona" };
  return { ok: true };
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}
