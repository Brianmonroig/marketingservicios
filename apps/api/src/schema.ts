import { boolean, customType, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const vector1536 = customType<{ data: number[] | null; driverData: string | null }>({
  dataType() {
    return "vector(1536)";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull(),
  settings: jsonb("settings").notNull(),
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  ...timestamps,
});

export const emailChallenges = pgTable("email_challenges", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  purpose: text("purpose").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  ...timestamps,
});

export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  ...timestamps,
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  stageId: uuid("stage_id"),
  source: text("source"),
  metaLeadId: text("meta_lead_id"),
  metaFormId: text("meta_form_id"),
  campaignId: text("campaign_id"),
  adsetId: text("adset_id"),
  adId: text("ad_id"),
  score: integer("score"),
  assignedTo: uuid("assigned_to"),
  whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
  optInAt: timestamp("opt_in_at", { withTimezone: true }),
  trade: text("trade"),
  serviceArea: text("service_area"),
  formAnswers: jsonb("form_answers").notNull().default({}),
  ...timestamps,
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  storageKey: text("storage_key").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  uploadedBy: uuid("uploaded_by"),
  ...timestamps,
});

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  documentId: uuid("document_id").notNull(),
  content: text("content").notNull(),
  embedding: vector1536("embedding"),
  embeddingModel: text("embedding_model"),
  embeddingDim: integer("embedding_dim"),
  chunkIndex: integer("chunk_index").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  ...timestamps,
});
