"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { requiredEnv } from "@/lib/env";

export type ActionState = { error?: string; ok?: boolean; message?: string };

const fail = (error: string | undefined, fallback: string): ActionState => ({ error: error ?? fallback });

// Meta devuelve al usuario a esta dirección después de iniciar sesión con Facebook.
export async function startMetaConnectionAction(): Promise<void> {
  const redirectUri = `${requiredEnv("AUTH_URL").replace(/\/$/, "")}/api/meta/callback`;
  const result = await apiFetch<{ url?: string }>("/integrations/meta/oauth-url", {
    method: "POST",
    body: JSON.stringify({ redirectUri }),
  });
  if (!result.ok || !result.data.url) {
    redirect(`/app/configuracion/integraciones?error=${encodeURIComponent(result.data.error ?? "No se pudo iniciar la conexión con Facebook")}`);
  }
  redirect(result.data.url);
}

export async function activatePageAction(id: string): Promise<void> {
  const result = await apiFetch(`/integrations/${id}/activate`, { method: "POST" });
  if (!result.ok) {
    redirect(`/app/configuracion/integraciones?error=${encodeURIComponent(result.data.error ?? "No se pudo activar la página")}`);
  }
  revalidatePath("/app/configuracion/integraciones");
  redirect("/app/configuracion/integraciones?ok=pagina");
}

export async function removeIntegrationAction(id: string): Promise<void> {
  const result = await apiFetch(`/integrations/${id}`, { method: "DELETE" });
  if (!result.ok) {
    redirect(`/app/configuracion/integraciones?error=${encodeURIComponent(result.data.error ?? "No se pudo desconectar")}`);
  }
  revalidatePath("/app/configuracion/integraciones");
  redirect("/app/configuracion/integraciones?ok=desconectado");
}

export async function connectWhatsAppAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch<{ displayPhoneNumber?: string }>("/integrations/whatsapp", {
    method: "POST",
    body: JSON.stringify({
      phoneNumberId: formData.get("phoneNumberId"),
      wabaId: formData.get("wabaId"),
      accessToken: formData.get("accessToken"),
    }),
  });
  if (!result.ok) return fail(result.data.error, "No se pudo conectar el número");
  revalidatePath("/app/configuracion/integraciones");
  return { ok: true, message: `Número conectado: ${result.data.displayPhoneNumber ?? ""}` };
}

export async function sendTextAction(conversationId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ type: "text", text: formData.get("text") }),
  });
  if (!result.ok) return fail(result.data.error, "No se pudo enviar el mensaje");
  revalidatePath("/app/crm/chat");
  return { ok: true };
}

export async function sendTemplateAction(conversationId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const params = formData.getAll("param").map((value) => String(value));
  const result = await apiFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      type: "template",
      name: formData.get("name"),
      language: formData.get("language"),
      params,
    }),
  });
  if (!result.ok) return fail(result.data.error, "No se pudo enviar la plantilla");
  revalidatePath("/app/crm/chat");
  return { ok: true };
}

export async function setOptInAction(leadId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch<{ firstContactSent?: boolean }>(`/leads/${leadId}/opt-in`, {
    method: "PATCH",
    body: JSON.stringify({ optIn: formData.get("optIn") === "true", origin: formData.get("origin") }),
  });
  if (!result.ok) return fail(result.data.error, "No se pudo guardar el permiso");
  revalidatePath("/app/crm/contactos", "layout");
  revalidatePath("/app/crm/oportunidades");
  return { ok: true, message: result.data.firstContactSent ? "Permiso guardado. Se envió la plantilla de primer contacto." : "Permiso guardado." };
}

export async function createTemplateAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const examples = String(formData.get("bodyExamples") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const result = await apiFetch<{ status?: string }>("/whatsapp/templates", {
    method: "POST",
    body: JSON.stringify({
      name: formData.get("name"),
      language: formData.get("language"),
      category: formData.get("category"),
      bodyText: formData.get("bodyText"),
      bodyExamples: examples,
    }),
  });
  if (!result.ok) return fail(result.data.error, "No se pudo crear la plantilla");
  revalidatePath("/app/configuracion/plantillas");
  return { ok: true, message: `Plantilla enviada a revisión de Meta (estado: ${result.data.status ?? "PENDING"}).` };
}

export async function setFirstContactAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const choice = String(formData.get("template") ?? "");
  if (!choice) {
    const cleared = await apiFetch("/whatsapp/first-contact-template", { method: "DELETE" });
    if (!cleared.ok) return fail(cleared.data.error, "No se pudo quitar la plantilla");
    revalidatePath("/app/configuracion/plantillas");
    return { ok: true, message: "Primer contacto desactivado." };
  }
  const [name, language] = choice.split("|");
  const params = String(formData.get("params") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const result = await apiFetch("/whatsapp/first-contact-template", {
    method: "PUT",
    body: JSON.stringify({ name, language, params }),
  });
  if (!result.ok) return fail(result.data.error, "No se pudo guardar la plantilla");
  revalidatePath("/app/configuracion/plantillas");
  return { ok: true, message: "Plantilla de primer contacto guardada." };
}

export async function saveOrganizationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch("/settings/organization", {
    method: "PATCH",
    body: JSON.stringify({
      name: formData.get("name"),
      companyLegalName: formData.get("companyLegalName") || undefined,
      language: formData.get("language"),
      timezone: formData.get("timezone"),
      currency: String(formData.get("currency") ?? "").toUpperCase(),
      dateFormat: formData.get("dateFormat"),
    }),
  });
  if (!result.ok) return fail(result.data.error, "No se pudo guardar la organización");
  revalidatePath("/app/configuracion/organizacion");
  return { ok: true, message: "Organización actualizada." };
}

export async function saveProfileAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const result = await apiFetch("/settings/profile", {
    method: "PATCH",
    body: JSON.stringify({
      name: formData.get("name"),
      language: formData.get("language"),
      timezone: formData.get("timezone"),
      notifyEmail: formData.get("notifyEmail") === "true",
      notifyInbox: formData.get("notifyInbox") === "true",
      ...(newPassword ? { currentPassword, newPassword } : {}),
    }),
  });
  if (!result.ok) return fail(result.data.error, "No se pudo guardar el perfil");
  revalidatePath("/app/configuracion/perfil");
  return { ok: true, message: "Perfil actualizado." };
}

export async function createStageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await apiFetch("/settings/pipelines/stages", {
    method: "POST",
    body: JSON.stringify({
      name: formData.get("name"),
      kind: formData.get("kind") || "open",
    }),
  });
  if (!result.ok) return fail(result.data.error, "No se pudo crear la etapa");
  revalidatePath("/app/configuracion/pipelines");
  revalidatePath("/app/crm/oportunidades");
  return { ok: true };
}

export async function saveCredentialAction(
  provider: "telegram" | "email" | "google",
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let body: Record<string, unknown>;
  if (provider === "telegram") {
    body = {
      provider: "telegram",
      botToken: formData.get("botToken"),
      policyNotes: formData.get("policyNotes") || undefined,
    };
  } else if (provider === "email") {
    body = {
      provider: "email",
      apiKey: formData.get("apiKey"),
      fromAddress: formData.get("fromAddress"),
      mailProvider: formData.get("mailProvider") || "other",
    };
  } else {
    body = {
      provider: "google",
      clientId: formData.get("clientId"),
      clientSecret: formData.get("clientSecret"),
    };
  }
  const result = await apiFetch("/settings/credentials", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!result.ok) return fail(result.data.error, "No se pudieron guardar las credenciales");
  revalidatePath("/app/configuracion/credenciales");
  return { ok: true };
}
