import { z } from "zod";

export const roles = ["owner", "admin", "agent"] as const;
export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;

export const assignableRoleSchema = z.enum(["admin", "agent"]);

const emailSchema = z
  .string()
  .trim()
  .email("El correo no es válido")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "La contraseña necesita al menos 8 caracteres")
  .max(200);

export const registerSchema = z.object({
  agencyName: z.string().trim().min(2, "El nombre de la agencia es demasiado corto").max(120),
  name: z.string().trim().min(2, "Tu nombre es demasiado corto").max(120),
  email: emailSchema,
  password: passwordSchema,
});

// 6 dígitos normales, o el código genérico de entorno (letras/números, espacios opcionales).
const authCodeSchema = z
  .string()
  .trim()
  .min(4, "El código es demasiado corto")
  .max(32, "El código es demasiado largo");

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: authCodeSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe la contraseña"),
});

export const verifyTwoFactorSchema = z.object({
  email: emailSchema,
  challengeId: z.string().uuid(),
  code: authCodeSchema,
});

export const resendCodeSchema = z.object({
  email: emailSchema,
  purpose: z.enum(["verify_email", "login_2fa"]),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: assignableRoleSchema,
});

export const defaultPipelineStages = [
  "Nuevo",
  "Contactado",
  "Cualificado",
  "Cita Agendada",
  "Venta Cerrada",
] as const;

export type RegisterInput = z.infer<typeof registerSchema>;
export type PublicUser = {
  id: string;
  tenantId: string;
  agencyName: string;
  name: string;
  email: string;
  role: Role;
};

// Fase 2: conexión con Meta
export const metaOAuthUrlSchema = z.object({
  redirectUri: z.string().url("La dirección de retorno no es válida"),
});

export const metaOAuthExchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  redirectUri: z.string().url(),
});

// Fase 3: conexión manual del número de WhatsApp (token del usuario del sistema)
export const whatsappConnectSchema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "El id del número solo lleva dígitos"),
  wabaId: z.string().trim().regex(/^\d{5,30}$/, "El id de la cuenta de WhatsApp Business solo lleva dígitos"),
  accessToken: z.string().trim().min(20, "El token es demasiado corto").max(1000),
});

export const sendMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().trim().min(1, "Escribe un mensaje").max(4096),
  }),
  z.object({
    type: z.literal("template"),
    name: z.string().trim().min(1).max(512),
    language: z.string().trim().min(2).max(10),
    params: z.array(z.string().trim().min(1).max(1024)).max(20).default([]),
  }),
]);

export const optInSchema = z.object({
  optIn: z.boolean(),
  origin: z.string().trim().min(2, "Indica de dónde viene el permiso").max(200),
});

export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,512}$/, "Solo minúsculas, números y guiones bajos"),
  language: z.string().trim().min(2).max(10),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  bodyText: z.string().trim().min(1).max(1024),
  bodyExamples: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
});

export const firstContactTemplateSchema = z.object({
  name: z.string().trim().min(1).max(512),
  language: z.string().trim().min(2).max(10),
  params: z.array(z.string().trim().min(1).max(1024)).max(20).default([]),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
