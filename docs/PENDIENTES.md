# Pendiente de acción manual o de fases posteriores

## Acceso sin correo (activo ahora)

- En Render, `AUTH_GENERIC_CODE=abc123`. Ese código vale para confirmar el correo y para el segundo paso de entrada. También acepta `abc 123`.
- Mientras exista esa variable, **no se envía ningún correo** (Resend se ignora).
- Es inseguro: cualquiera que sepa un correo registrado y el código genérico puede entrar al segundo paso tras la contraseña. Quitar `AUTH_GENERIC_CODE` cuando haya un envío de correo real.

## Para enviar códigos por correo de verdad

- Crear cuenta en un servicio de correo (Resend, Brevo, etc.), verificar remitente, poner las claves en `crm-api` y **vaciar o borrar** `AUTH_GENERIC_CODE`.
- En Render el SMTP clásico está bloqueado en el plan gratuito; hace falta una API de correo.

## Para que lleguen leads y mensajes reales (fases 2 y 3)

Estas cosas las tienes que hacer tú en Meta. El código ya está, pero no se ha probado contra Meta real, solo contra un simulador de pruebas (`apps/api/src/meta.mock.ts`, que solo usan los tests).

1. Crear una app en developers.facebook.com y copiar `META_APP_ID` y `META_APP_SECRET` a `crm-api` en Render.
2. `META_WEBHOOK_VERIFY_TOKEN` lo genera Render. Hay que pegar ese mismo valor en Meta, como «token de verificación», para los dos webhooks.
3. En Meta, dar de alta como URL de devolución de llamada:
   - Lead Ads (producto Webhooks → objeto Page → campo `leadgen`): `https://<crm-api>.onrender.com/webhooks/meta`
   - WhatsApp (producto WhatsApp → Configuración → Webhook, campo `messages`): `https://<crm-api>.onrender.com/webhooks/whatsapp`
4. Añadir `https://<crm-web>.onrender.com/api/meta/callback` como «URI de redirección OAuth válida» del inicio de sesión con Facebook.
5. Permisos de la app. Meta pide revisión (App Review) para usarlos con páginas de terceros. El código solicita los que figuran en `META_PAGE_SCOPES` (`apps/api/src/meta.ts`). Hay que contrastarlos con la documentación vigente de Meta antes de enviar la revisión.
6. WhatsApp se conecta a mano en Conexiones: id del número, id de la cuenta de WhatsApp Business y una clave de acceso permanente. Para crear plantillas desde el CRM, esa clave necesita el permiso `whatsapp_business_management`.

## Cosas que no he podido verificar

- La documentación para desarrolladores de Meta no se pudo leer desde aquí (devolvió errores 403/400). Los nombres de endpoints, campos y permisos de `meta.ts` salen de fuentes secundarias y de la versión `v25.0` por defecto. Hay que contrastarlos con https://developers.facebook.com/docs antes de salir a producción. Si alguno cambió, se corrige en `apps/api/src/meta.ts` y los tests siguen sirviendo.
- La duración del token de página de Facebook. Se pide un token de larga duración y se guarda cifrado. Si Meta lo invalida, la integración pasa a «Con error» (al recibir un 401) y hay que reconectar.
- La versión de la Graph API puede cambiarse con `META_GRAPH_VERSION`.

## Limitaciones conocidas de esta versión

- Embedded Signup de WhatsApp no está construido. La conexión es manual.
- Los mensajes entrantes con imagen, audio o documento se guardan como texto marcador. No se descargan los archivos (llegan en la fase 4, con la carpeta de archivos).
- Los campos personalizados del formulario de Lead Ads se guardan tal cual en `form_answers`. No se mapean automáticamente a oficio ni zona de cobertura.
- Si el mismo teléfono llega por Meta y por WhatsApp, se busca el lead por teléfono normalizado (E.164). Si Meta entrega un teléfono mal formado puede haber dos fichas del mismo contacto.
- El consentimiento de WhatsApp se registra a mano en la ficha del lead (con fecha y origen). No se lee de un campo del formulario.
- Hasta la fase 5, las conversaciones nacen con `ai_enabled = false` y estado «humano».
- Redis gratuito de Render no guarda en disco. Si se reinicia, se pierde la cola. Los avisos de Meta están guardados en Postgres y un barrido cada minuto reprocesa los que quedaron sin procesar (de 2 minutos a 24 horas). Los mensajes salientes que estaban en cola y no salieron se quedan en «En cola»: reenviar a mano.
- El worker de la cola corre dentro del proceso del API, porque el plan gratuito no tiene workers. Si el API se duerme, no procesa. Meta reintenta sus webhooks, pero conviene un servicio que lo despierte o pasar a un plan de pago.

## Plan gratuito de Render

- El Postgres gratuito caduca a los 30 días y no tiene copias de seguridad. Fuente: https://render.com/docs/free. **El actual caduca hacia el 13 de noviembre de 2026.**
- Los servicios web gratuitos se duermen a los 15 minutos sin tráfico.
- No hay región España. El despliegue usa `frankfurt`.
- `pgvector` se activa con `CREATE EXTENSION vector`. Fuente: https://render.com/docs/postgresql-extensions
- El pooler gestionado queda en `none`. La sesión de cada petición fija `app.tenant_id` dentro de la transacción.
- El Key Value (Redis) gratuito necesita `ipAllowList: []` y `maxmemoryPolicy: noeviction` en el Blueprint.

## Seguridad pendiente

- Rotar los secretos que se compartieron en conversaciones anteriores (claves de Render y de base de datos).

## Esta versión no incluye, a propósito

- Carpeta de archivos en la nube. MinIO está en Docker local. Los documentos son la fase 4.
- Documentos con búsqueda por similitud, agente de IA, tablero, paquetes, propuestas y envío de conversiones a Meta (fases 4 a 7).
- Nombres de modelo. En la fase 5 se consultará la documentación vigente de Anthropic y de OpenAI antes de fijar un identificador. Si un nombre no se puede verificar, se queda aquí y no se inventa.

## Decisiones de datos ya cerradas

- Cada alta pública crea una agencia y un usuario dueño. Las demás personas se crean dentro de esa agencia y también confirman su correo.
- El correo es único en todo el sistema en esta versión.
- `webhook_events.tenant_id` es nulo hasta que se sepa la agencia. Insertar un aviso sin agencia exige `app.ingest = on`, y solo se pueden leer y marcar esas filas con ese ajuste. Ninguna agencia puede leer esas filas.
- La agencia de un aviso se resuelve con la integración activa del mismo proveedor y cuenta (página o número). Una misma página o número solo puede estar activa en una agencia.
- Los leads manuales no llevan `meta_lead_id`. La unicidad de ese identificador aplica solo cuando existe.
- Las plantillas de WhatsApp requieren permiso (`whatsapp_opt_in`). El texto libre solo sale si el lead escribió hace menos de 24 horas.
- La única excepción de aislamiento es el login: se puede leer la fila de `users` cuyo email coincide con `app.auth_email`. El resto de tablas no tiene esa puerta.
