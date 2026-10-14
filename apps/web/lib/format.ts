// La zona horaria es fija para que el servidor y el navegador pinten lo mismo.
const TIME_ZONE = "Europe/Madrid";

const dateTime = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });
const timeOnly = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });

export function formatDateTime(value: string | Date | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function formatDate(value: string | Date | null | undefined): string {
  return value ? dateOnly.format(new Date(value)) : "—";
}

export function formatTime(value: string | Date | null | undefined): string {
  return value ? timeOnly.format(new Date(value)) : "";
}

export const roleLabel: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  agent: "Agente",
};

export const sourceLabel: Record<string, string> = {
  meta_lead_ads: "Meta",
  whatsapp: "WhatsApp",
};

export const messageStatusLabel: Record<string, string> = {
  queued: "En cola",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Fallido",
};

export const eventLabel: Record<string, string> = {
  lead_created: "Lead creado",
  message: "Mensaje",
  opt_in: "Permiso de WhatsApp",
};
