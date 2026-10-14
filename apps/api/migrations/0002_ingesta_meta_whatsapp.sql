-- Fases 2 y 3: ingesta de Meta Lead Ads y mensajería de WhatsApp.
--
-- Los webhooks de Meta llegan sin sesión de agencia. Para saber a qué agencia
-- pertenecen hay que leer la integración por el identificador que trae el evento
-- (id de la página o id del número de WhatsApp). Esa lectura se abre solo para
-- una fila concreta, la que coincide con las dos variables de sesión
-- app.ingest_provider y app.ingest_account. No hay ninguna política que deje
-- listar las integraciones de otras agencias.

-- Una página o un número solo puede estar activo en una agencia.
CREATE UNIQUE INDEX integrations_active_account_idx
  ON integrations (provider, external_account_id)
  WHERE status = 'active';

CREATE POLICY integrations_ingest_read ON integrations
  FOR SELECT
  USING (
    status = 'active'
    AND provider = NULLIF(current_setting('app.ingest_provider', true), '')
    AND external_account_id = NULLIF(current_setting('app.ingest_account', true), '')
  );

-- Los eventos recibidos se guardan sin agencia (tenant_id nulo) y el worker los
-- lee y los marca como procesados con app.ingest = 'on'.
CREATE POLICY webhook_events_ingest_read ON webhook_events
  FOR SELECT
  USING (tenant_id IS NULL AND current_setting('app.ingest', true) = 'on');

CREATE POLICY webhook_events_ingest_update ON webhook_events
  FOR UPDATE
  USING (tenant_id IS NULL AND current_setting('app.ingest', true) = 'on')
  WITH CHECK (
    current_setting('app.ingest', true) = 'on'
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

-- Una sola conversación de WhatsApp por lead, también cuando llegan dos mensajes
-- a la vez.
CREATE UNIQUE INDEX conversations_lead_channel_idx
  ON conversations (tenant_id, lead_id, channel);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS conversations_tenant_last_message_idx
  ON conversations (tenant_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS lead_events_lead_idx
  ON lead_events (lead_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS webhook_events_pending_idx
  ON webhook_events (created_at)
  WHERE processed_at IS NULL;

-- Teléfono normalizado: un lead por número dentro de cada agencia.
CREATE INDEX IF NOT EXISTS leads_tenant_phone_idx
  ON leads (tenant_id, phone)
  WHERE phone IS NOT NULL;

-- Datos de la plantilla de un mensaje saliente (nombre, idioma y variables).
-- El worker los necesita para armar el envío.
ALTER TABLE messages ADD COLUMN template jsonb;
