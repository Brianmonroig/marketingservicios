-- Configuración persistente + separación contactos / oportunidades (sin borrar leads).
-- Expandir → rellenar. Las lecturas nuevas usan contacts/opportunities; leads se mantienen para ingesta.

ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations
  ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('meta_page', 'whatsapp', 'telegram', 'email', 'google'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'open';
-- kind: open | won | lost | inbox

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name text,
  email text,
  phone text,
  source text,
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  opt_in_at timestamptz,
  trade text,
  service_area text,
  form_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to uuid REFERENCES users (id),
  legacy_lead_id uuid REFERENCES leads (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_tenant_legacy_lead_idx
  ON contacts (tenant_id, legacy_lead_id)
  WHERE legacy_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_tenant_phone_idx ON contacts (tenant_id, phone);
CREATE INDEX IF NOT EXISTS contacts_tenant_email_idx ON contacts (tenant_id, email);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  stage_id uuid REFERENCES pipeline_stages (id),
  name text,
  amount numeric(18, 2),
  currency text NOT NULL DEFAULT 'EUR',
  source text,
  status text NOT NULL DEFAULT 'open',
  loss_reason text,
  assigned_to uuid REFERENCES users (id),
  campaign_id text,
  adset_id text,
  ad_id text,
  meta_lead_id text,
  legacy_lead_id uuid REFERENCES leads (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_tenant_legacy_lead_idx
  ON opportunities (tenant_id, legacy_lead_id)
  WHERE legacy_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS opportunities_tenant_stage_idx ON opportunities (tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS opportunities_tenant_contact_idx ON opportunities (tenant_id, contact_id);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts (id);

-- Backfill contactos desde leads existentes (idempotente).
INSERT INTO contacts (
  id, tenant_id, name, email, phone, source, whatsapp_opt_in, opt_in_at,
  trade, service_area, form_answers, assigned_to, legacy_lead_id, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  l.tenant_id,
  l.name,
  l.email,
  l.phone,
  l.source,
  l.whatsapp_opt_in,
  l.opt_in_at,
  l.trade,
  l.service_area,
  l.form_answers,
  l.assigned_to,
  l.id,
  l.created_at,
  l.updated_at
FROM leads l
WHERE NOT EXISTS (
  SELECT 1 FROM contacts c WHERE c.tenant_id = l.tenant_id AND c.legacy_lead_id = l.id
);

-- Backfill oportunidades (una por lead).
INSERT INTO opportunities (
  id, tenant_id, contact_id, stage_id, name, source, status,
  assigned_to, campaign_id, adset_id, ad_id, meta_lead_id, legacy_lead_id, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  l.tenant_id,
  c.id,
  l.stage_id,
  COALESCE(l.name, l.phone, l.email, 'Oportunidad'),
  l.source,
  'open',
  l.assigned_to,
  l.campaign_id,
  l.adset_id,
  l.ad_id,
  l.meta_lead_id,
  l.id,
  l.created_at,
  l.updated_at
FROM leads l
JOIN contacts c ON c.tenant_id = l.tenant_id AND c.legacy_lead_id = l.id
WHERE NOT EXISTS (
  SELECT 1 FROM opportunities o WHERE o.tenant_id = l.tenant_id AND o.legacy_lead_id = l.id
);

-- Enlazar conversaciones al contacto migrado.
UPDATE conversations conv
SET contact_id = c.id
FROM contacts c
WHERE conv.contact_id IS NULL
  AND c.legacy_lead_id = conv.lead_id
  AND c.tenant_id = conv.tenant_id;

-- RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_tenant ON contacts;
CREATE POLICY contacts_tenant ON contacts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS opportunities_tenant ON opportunities;
CREATE POLICY opportunities_tenant ON opportunities
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON contacts TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON opportunities TO app_user;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS opportunities_updated_at ON opportunities;
CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
