# Auditoría CRM — North Scale / Marketing Servicios Local

Fecha: 2026-10-29  
Alcance: estado del repositorio antes de ampliar Configuración e Integraciones (prompt estilo Kommo, sin copiar marca).

## Stack verificado

| Capa | Tecnología | Notas |
|---|---|---|
| Monorepo | pnpm + Turborepo | `apps/web`, `apps/api`, `packages/shared` |
| Web | Next.js 15 App Router, React 19, Tailwind, next-auth 5 | Diseño North Scale |
| API | Fastify 5, Drizzle, Zod, JWT | Workers BullMQ **dentro** del proceso API |
| DB | PostgreSQL + pgvector + RLS (`app.tenant_id`) | Migraciones SQL en `apps/api/migrations` |
| Cola / realtime | Redis (BullMQ + pub/sub SSE) | Plan free sin persistencia de Redis |
| Despliegue | Render Blueprint | Web `crm-web-37uo`, API `crm-api-g0h1` |

## Capacidades existentes (operativas en código)

- Auth: registro, verificación, login 2FA, olvidé contraseña; `AUTH_GENERIC_CODE` para pruebas sin correo.
- Multi-tenant: `tenants`, `users` (roles `owner` \| `admin` \| `agent`), RLS.
- Meta Lead Ads: OAuth de páginas, webhook firmado, ingesta idempotente, leads con atribución parcial.
- WhatsApp Cloud API: conexión manual (phoneNumberId + WABA + token cifrado), inbox, ventana 24 h, plantillas list/create, opt-in manual, cola de envío.
- CRM UI (shell GHL): Chat, Contactos, Tickets (solo UI), Oportunidades (Kanban sobre etapas de leads), Dashboard.
- Config parcial: Integraciones Meta/WhatsApp, Plantillas, Equipo; Canales Telegram/correo **deshabilitados sin persistencia**.

## Capacidades parciales

- Pipelines: solo `pipeline_stages` fijos al crear tenant; no hay CRUD multi-pipeline ni ganado/perdido.
- Contactos vs oportunidades: un único modelo `leads` mezcla contacto y oportunidad.
- Integraciones: tabla `integrations` con token cifrado y `status`; no separa instalación / OAuth / activo / suscripción como pide el prompt.
- Tickets: tablero vacío sin tablas ni API.
- Canales Telegram/correo: pantallas placeholder.
- Documentos/pgvector: tablas presentes; flujo de documentos no expuesto en UI actual.
- Meta scopes y Graph version: documentados como **no verificados** contra docs oficiales (403 histórico).

## Capacidades ausentes (respecto al prompt)

- Organización rica (idioma, TZ IANA, moneda, horario, festivos) con API/UI de guardado.
- Mi perfil (avatar, 2FA de app, sesiones, notificaciones).
- Roles ampliados (responsable de equipo, comercial, lector) y permisos por entidad/alcance.
- Equipos, invitaciones, reasignación al dar de baja.
- Campos personalizados tipados, etiquetas, catálogos, productos.
- Empresas, contactos multi-identidad, relación M2N lead↔contacto.
- Bandeja de entradas pendientes (accept/reject).
- Tareas, notas, archivos con permisos.
- Catálogo de integraciones extensible + OAuth PKCE genérico + health/sync runs.
- Messenger, Instagram, Meta Ads/audiencias, CAPI.
- Embedded Signup WhatsApp, difusiones, Flows, catálogos Meta.
- Google (Gmail, Calendar, Sheets, Ads, GA4).
- Automatizaciones/bots, segmentos, import/export, webhooks salientes, API pública con scopes.
- Auditoría de configuración, IP allowlist, plan/consumo real (sin inventar billing).

## Tablas reutilizables

`tenants`, `users`, `email_challenges`, `pipeline_stages`, `leads`, `lead_events`, `integrations`, `conversations`, `messages`, `webhook_events`, `documents`, `document_chunks`.

## Deuda técnica

- UI antigua (`/app/leads`, nav top) aún visible si Render no despliega el sidebar; redirects existen en código.
- Cold start Render free → errores «API no responde».
- Un solo booleano/status en integraciones no modela salud vs autorización vs sync.
- `leads` sobrecargado; dificulta ficha unificada Kommo-like.
- Tests de Meta con mock; no hay validación real autorizada.
- Sin OpenAPI; contratos Zod en `packages/shared` parciales.

## Riesgos y dependencias externas

- Meta App Review, WABA, permisos de página.
- Proveedor de correo (Resend/Brevo) o `AUTH_GENERIC_CODE` inseguro.
- Google: Customer Match / Data Manager con restricciones para apps nuevas (ver docs oficiales).
- No hay secretos de Google/Telegram en el repo; no se debe simular «conectado».

## Decisiones de continuidad

1. No crear un segundo sistema de usuarios/contactos.
2. Ampliar `tenants.settings` y tablas nuevas solo con migraciones incrementales.
3. Marcar en matriz como «implementada, pendiente de conexión» cuando falte secreto.
4. Fases del prompt A→G; esta entrega arranca por **A (docs) + B (Configuración persistente)** tras confirmar preguntas bloqueantes.
