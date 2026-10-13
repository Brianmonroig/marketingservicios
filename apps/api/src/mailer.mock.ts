import type { Mailer } from "./mailer.js";
import { sentMessages } from "./mailer.mock-store.js";

export function createMockMailer(): Mailer {
  return {
    async sendVerificationCode(input) {
      sentMessages.push(input);
    },
  };
}
