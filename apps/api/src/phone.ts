import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Devuelve el teléfono en formato E.164 o null si no es un número válido.
export function normalizePhone(raw: string | null | undefined, defaultCountry: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const country = defaultCountry && /^[A-Za-z]{2}$/.test(defaultCountry) ? (defaultCountry.toUpperCase() as CountryCode) : undefined;
  const parsed = parsePhoneNumberFromString(cleaned, country);
  if (!parsed?.isValid()) return null;
  return parsed.number;
}

// WhatsApp entrega el número sin "+" (por ejemplo 34612345678).
export function phoneFromWhatsApp(waId: string): string | null {
  const digits = waId.replace(/\D/g, "");
  if (!digits) return null;
  return normalizePhone(`+${digits}`, undefined);
}

export function whatsappRecipient(e164: string): string {
  return e164.replace(/^\+/, "");
}
