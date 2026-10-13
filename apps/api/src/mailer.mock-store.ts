import type { MailPurpose } from "./mailer.js";

export const sentMessages: Array<{ to: string; code: string; purpose: MailPurpose }> = [];

export function lastCode(to: string, purpose: MailPurpose): string {
  const match = [...sentMessages].reverse().find((message) => message.to === to && message.purpose === purpose);
  if (!match) {
    throw new Error(`No hay código ${purpose} para ${to}`);
  }
  return match.code;
}
