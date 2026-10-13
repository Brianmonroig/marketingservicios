import { auth } from "@/auth";
import { requiredEnv } from "@/lib/env";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const session = await auth();
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  if (session?.accessToken) {
    headers.set("authorization", `Bearer ${session.accessToken}`);
  }
  const response = await fetch(`${requiredEnv("API_URL")}${path}`, { ...init, headers, cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: response.ok, status: response.status, data };
}
