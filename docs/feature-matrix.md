# Matriz de requisitos (prompt CRM / Configuración e Integraciones)

Leyenda de estado: `ausente` · `parcial` · `ui-sin-backend` · `implementada` · `implementada-pendiente-conexion` · `fuera-alcance` · `bloqueada-proveedor`.

Fuentes: `K` = capacidad descrita en docs Kommo (evidencia funcional, no API nuestra); `P` = propuesta de producto para este CRM; `V` = pendiente validar con Meta/Google; `E` = ya existe en este repo.

| ID | Fuente | Requisito | Pantalla | Endpoint/servicio | Tablas | Permisos | Prueba | Estado | Bloqueo |
|---|---|---|---|---|---|---|---|---|---|
| CFG-01 | P | Navegación Config con búsqueda y secciones | `/app/configuracion` | — | — | owner/admin | manual | implementada | — |
| CFG-02 | P/K | Organización (nombre, idioma, TZ, moneda) | Config → Organización | `GET/PATCH /settings/organization` | `tenants.settings` | owner/admin | API | implementada | Horario laboral UI pendiente |
| CFG-03 | P | Mi perfil | Config → Perfil | `GET/PATCH /settings/profile` | `users.preferences` | self | API | implementada | Avatar storage fase 4 |
| CFG-04 | E/P | Usuarios equipo | Config → Equipo | `/admin/users` | `users` | owner/admin | phase1 | parcial | Sin invitaciones/desactivar/reasignar |
| CFG-05 | P | Roles ampliados + permisos por entidad | Config → Roles | — | roles/permissions | owner | — | fuera-alcance | Confirmado: owner/admin/agent |
| CFG-06 | E/P | Pipelines y etapas | Config → Pipelines | `GET/POST/PATCH /settings/pipelines*` | `pipeline_stages.kind` | owner/admin | manual | parcial | Sin multi-pipeline ni drag-order UI |
| CFG-07 | P | Campos personalizados | Config → Campos | — | custom_field_* | owner/admin | — | ui-sin-backend | Stub honesto |
| CFG-08 | P | Comunicación (bandejas, firmas, RR) | Config → Comunicación | — | — | — | — | parcial | Enlaces a Chat/Plantillas; firmas pendientes |
| CFG-09 | P/K | Automatizaciones | Config → Automatizaciones | — | — | — | — | ui-sin-backend | Stub; sin envíos simulados |
| CFG-10 | E | Integraciones Meta página + WhatsApp | Config → Integraciones | `/integrations*` | `integrations` | owner/admin | phase2/3 | parcial | Modelo conexión incompleto |
| CFG-11 | P | Catálogo integraciones + health/sync | Config → Credenciales | `GET /settings/credentials` | `integrations` | owner/admin | manual | parcial | Health/sync real pendiente |
| CFG-12 | P | Canales Telegram/correo/Google (credenciales) | Config → Credenciales | `PUT /settings/credentials` | `integrations` cifrado | owner/admin | manual | implementada | `sendsEnabled: false` hasta acción admin |
| CFG-13 | P | Datos import/export/auditoría | Config → Datos | — | — | — | — | ui-sin-backend | Stub |
| CFG-14 | P | Métricas y atribución | Config → Métricas | — | — | — | — | ui-sin-backend | Stub |
| CFG-15 | P | Plan y capacidades reales | Config → Plan | `GET /settings/plan` | `tenants.plan` | owner/admin | manual | implementada | Sin billing inventado |
| CRM-01 | E | Chat WhatsApp | CRM → Chat | `/conversations*` | conversations/messages | all | phase3 | implementada | Media no descargada |
| CRM-02 | E/P | Contactos | CRM → Contactos | `GET/POST/PATCH /contacts*` | `contacts` | all | manual | implementada | Empresas/M2N pendiente |
| CRM-03 | P | Tickets | CRM → Tickets | `GET/POST/PATCH /tickets` | `tickets` | all | manual | implementada | Crear desde chat con un clic pendiente |
| CRM-04 | E/P | Oportunidades Kanban | CRM → Oportunidades | `GET/POST/PATCH /opportunities` | `opportunities` | all | manual | implementada | Drag-and-drop pendiente |
| CRM-05 | P | Demo seed integral | Contactos → Cargar ejemplo | `POST /crm/demo-seed` | contacts/opps/tickets/chat demo | owner/admin | manual | implementada | Sin envío WhatsApp |
| META-01 | E/V | Lead Ads webhook+OAuth | Integraciones | `/webhooks/meta` | leads+contacts | manager | phase2 mock | implementada-pendiente-conexion | App Review / docs Meta |
| META-02 | V | Messenger/IG/Ads/CAPI | — | — | — | — | — | ausente | Validar Graph actual |
| WA-01 | E/V | WhatsApp Cloud API inbox/send/templates | Integraciones+Chat+Plantillas | `/webhooks/whatsapp` | messages… | — | phase3 mock | implementada-pendiente-conexion | Embedded Signup ausente |
| GOOG-01 | V | Gmail/Calendar/Sheets/Ads/GA4 | Credenciales Google | guarda client id/secret | integrations | manager | — | parcial | OAuth por producto pendiente |
| SEC-01 | E | RLS tenant | — | db | all | — | phase1 | implementada | — |
| SEC-02 | P | 2FA app, sesiones, IP allowlist, audit logs | Config → Seguridad | — | — | — | — | ui-sin-backend | Stub + cambio password en perfil |
| AUTO-01 | P | Reglas/bots/difusiones | — | — | — | — | — | ausente | — |
| DATA-01 | P | Import/export CSV | — | — | — | — | — | ausente | — |

## Notas

- Nada se marca `implementada` si solo hay UI.
- Kommo se usa como **evidencia de capacidad de producto**, no como especificación de API Meta/Google.
- Actualizar esta matriz en cada fase (`docs/crm-implementation-log.md`).
