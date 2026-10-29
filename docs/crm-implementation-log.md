# Registro de implementación CRM

## 2026-10-29 (fase B · Config + contactos/oportunidades)

Confirmaciones del usuario: (1) Config primero con persistencia real; (2) roles owner/admin/agent; (3) separar contactos y oportunidades; (4) bloques de credenciales en Config; (5) sin envíos reales sin acción explícita de admin.

### Entregado

- Migración `0004_config_contacts_opportunities.sql`: providers telegram/email/google, `users.preferences`, `pipeline_stages.kind`, tablas `contacts`/`opportunities`, backfill desde `leads`, `conversations.contact_id`, RLS.
- API: `GET/PATCH /settings/organization|profile`, pipelines stages, `GET/PUT /settings/credentials` (secretos cifrados, `sendsEnabled: false`), `GET /settings/plan`, `GET /contacts`, `GET /contacts/:id`, `GET /opportunities`.
- Espejo lead→contacto/oportunidad en ingesta y opt-in (`ensureContactFromLead`).
- UI Config: hub buscable, organización, perfil, pipelines, credenciales, plan, stubs honestos (campos, comunicación, automatizaciones, datos, métricas, seguridad).
- CRM Contactos/Oportunidades leen las tablas nuevas (no el listado de leads).

### No hecho (a propósito)

- Envío Telegram/correo/Google.
- OAuth Google por producto, Meta expandido, automatizaciones, tickets persistentes, campos custom, drag-and-drop de etapas/oportunidades.

## 2026-10-29 (inicio)

- Creada auditoría `docs/crm-audit.md`.
- Creada matriz `docs/feature-matrix.md`.
- Preguntas bloqueantes respondidas por el usuario.
