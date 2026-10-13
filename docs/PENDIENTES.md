# Pendiente de acción manual o de fases posteriores

## Para que el registro envíe correos en Render

- Crear una cuenta en Resend y verificar un remitente.
- Poner `RESEND_API_KEY` y `RESEND_FROM` en el servicio `crm-api`.
- Sin esas dos variables, el API de producción rechaza el envío. No finge que el correo salió.

## Plan gratuito de Render

- El Postgres gratuito caduca a los 30 días y no tiene copias de seguridad. Fuente: https://render.com/docs/free
- Los servicios web gratuitos se duermen a los 15 minutos sin tráfico.
- No hay región España. El despliegue usa `frankfurt`.
- `pgvector` se activa con `CREATE EXTENSION vector`. Fuente: https://render.com/docs/postgresql-extensions
- El pooler gestionado queda en `none`. La sesión de cada petición fija `app.tenant_id` dentro de la transacción.

## Esta fase no incluye, a propósito

- Redis y el worker de colas en Render. Están en Docker local. Las colas empiezan en la fase 2.
- Carpeta de archivos en la nube. MinIO está en Docker local. Los documentos son la fase 4.
- Inbox en tiempo real. La decisión para la fase 3 es SSE, no WebSockets.
- WhatsApp, Meta Lead Ads, CAPI y el agente de IA.
- Nombres de modelo. En la fase 5 se consultará la documentación vigente de Anthropic y de OpenAI antes de fijar un identificador. Si un nombre no se puede verificar, se queda aquí y no se inventa.

## Permisos externos que llegarán en fases siguientes

- App Review de Meta, incluido `leads_retrieval` y los permisos de página. Hay que contrastarlos con la documentación vigente antes de darlos por buenos.
- WhatsApp Cloud API, verificación del negocio, Embedded Signup y plantillas aprobadas.
- El campo del formulario de Lead Ads que marcará `whatsapp_opt_in`. El sistema espera ese consentimiento antes de escribir por WhatsApp. El mapeo del campo se hace en la fase 2, no está inventado aquí.

## Decisiones de datos ya cerradas

- Cada alta pública crea una agencia y un usuario dueño. Las demás personas se crean dentro de esa agencia y también confirman su correo.
- El correo es único en todo el sistema en esta versión.
- `webhook_events.tenant_id` es nulo hasta que se sepa la agencia. Insertar un aviso sin agencia exige `app.ingest = on`. Ninguna agencia puede leer esas filas.
- Los leads manuales no llevan `meta_lead_id`. La unicidad de ese identificador aplica solo cuando existe.
- La única excepción de aislamiento es el login: se puede leer la fila de `users` cuyo email coincide con `app.auth_email`. El resto de tablas no tiene esa puerta.
