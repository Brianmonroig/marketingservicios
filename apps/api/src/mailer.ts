export type MailPurpose = "verify_email" | "login_2fa";

export type Mailer = {
  sendVerificationCode(input: { to: string; code: string; purpose: MailPurpose }): Promise<void>;
};

const subjects: Record<MailPurpose, string> = {
  verify_email: "Confirma tu correo",
  login_2fa: "Tu código para entrar",
};

function message(code: string, purpose: MailPurpose): string {
  const reason =
    purpose === "verify_email"
      ? "Usa este código para confirmar que el correo es tuyo."
      : "Usa este código para confirmar que eres tú quien entra.";
  return `${reason}\n\nCódigo: ${code}\n\nCaduca en 10 minutos. Si no has pedido este código, ignora el mensaje.`;
}

export function createResendMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error("Faltan RESEND_API_KEY y RESEND_FROM");
  }

  return {
    async sendVerificationCode({ to, code, purpose }) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: subjects[purpose],
          text: message(code, purpose),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend respondió ${response.status}: ${body.slice(0, 300)}`);
      }
    },
  };
}

export function createConsoleMailer(): Mailer {
  return {
    async sendVerificationCode({ to, code, purpose }) {
      console.info(`[correo de desarrollo] ${purpose} para ${to}: ${code}`);
    },
  };
}

export function createUnavailableMailer(): Mailer {
  return {
    async sendVerificationCode() {
      throw new Error(
        "El envío de correos no está configurado. Añade RESEND_API_KEY y RESEND_FROM.",
      );
    },
  };
}

export function createMailer(): Mailer {
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    return createResendMailer();
  }
  if (process.env.NODE_ENV === "production") {
    return createUnavailableMailer();
  }
  return createConsoleMailer();
}
