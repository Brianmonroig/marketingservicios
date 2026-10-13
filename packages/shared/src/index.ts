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

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "El código tiene 6 números"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe la contraseña"),
});

export const verifyTwoFactorSchema = z.object({
  email: emailSchema,
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "El código tiene 6 números"),
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
