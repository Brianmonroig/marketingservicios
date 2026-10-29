import { auth } from "@/auth";
import { requiredEnv } from "@/lib/env";

export type ApiResult<T = Record<string, unknown>> = { ok: boolean; status: number; data: T & { error?: string; code?: string } };

export async function apiFetch<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const session = await auth();
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  if (session?.accessToken) {
    headers.set("authorization", `Bearer ${session.accessToken}`);
  }
  try {
    const response = await fetch(`${requiredEnv("API_URL")}${path}`, { ...init, headers, cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as ApiResult<T>["data"];
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "No se pudo conectar con el servidor" } as ApiResult<T>["data"] };
  }
}

export type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  score: number | null;
  whatsappOptIn: boolean;
  campaignId: string | null;
  createdAt: string;
  stageName: string | null;
};

export type IntegrationRow = {
  id: string;
  provider: "meta_page" | "whatsapp";
  externalAccountId: string;
  status: string;
  name: string | null;
  metadata: Record<string, unknown>;
};

export type ConversationRow = {
  id: string;
  status: string;
  channel?: string;
  contactId?: string | null;
  leadId: string;
  leadName: string | null;
  leadPhone: string | null;
  lastMessageAt: string | null;
  lastContent: string | null;
  lastDirection: string | null;
  windowOpen: boolean;
};

export type MessageRow = {
  id: string;
  direction: "in" | "out";
  senderType: string;
  type: string;
  content: string | null;
  status: string;
  error: string | null;
  createdAt: string;
};

export type TemplateRow = {
  name: string;
  language: string;
  status: string;
  category: string;
  bodyText: string;
};
