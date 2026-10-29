import { boolean, customType, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
  preferences: jsonb("preferences").notNull().default({}),
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
  kind: text("kind").notNull().default("open"),
  ...timestamps,
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  source: text("source"),
  whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
  optInAt: timestamp("opt_in_at", { withTimezone: true }),
  trade: text("trade"),
  serviceArea: text("service_area"),
  formAnswers: jsonb("form_answers").notNull().default({}),
  assignedTo: uuid("assigned_to"),
  legacyLeadId: uuid("legacy_lead_id"),
  ...timestamps,
});

export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contactId: uuid("contact_id").notNull(),
  stageId: uuid("stage_id"),
  name: text("name"),
  amount: numeric("amount", { precision: 18, scale: 2 }),
  currency: text("currency").notNull().default("EUR"),
  source: text("source"),
  status: text("status").notNull().default("open"),
  lossReason: text("loss_reason"),
  assignedTo: uuid("assigned_to"),
  campaignId: text("campaign_id"),
  adsetId: text("adset_id"),
  adId: text("ad_id"),
  metaLeadId: text("meta_lead_id"),
  legacyLeadId: uuid("legacy_lead_id"),
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

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  provider: text("provider").notNull(),
  externalAccountId: text("external_account_id").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  status: text("status").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  ...timestamps,
});

export const leadEvents = pgTable("lead_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  leadId: uuid("lead_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contactId: uuid("contact_id").notNull(),
  conversationId: uuid("conversation_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("nuevo"),
  priority: text("priority").notNull().default("normal"),
  assigneeId: uuid("assignee_id"),
  source: text("source"),
  ...timestamps,
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  leadId: uuid("lead_id").notNull(),
  contactId: uuid("contact_id"),
  channel: text("channel").notNull(),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  status: text("status").notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  ...timestamps,
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  conversationId: uuid("conversation_id").notNull(),
  direction: text("direction").notNull(),
  senderType: text("sender_type").notNull(),
  type: text("type").notNull(),
  content: text("content"),
  mediaUrl: text("media_url"),
  externalId: text("external_id"),
  status: text("status").notNull(),
  error: text("error"),
  aiMetadata: jsonb("ai_metadata"),
  template: jsonb("template").$type<{ name: string; language: string; params: string[] } | null>(),
  ...timestamps,
});

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  ...timestamps,
});
