# Marketing Servicios Local

CRM para agencias que venden marketing a negocios de servicios a domicilio. Esta entrega es la fase 1: el espacio de cada agencia, el registro y la entrada con un código al correo.

## Qué hay en marcha

- La web (`apps/web`) y el API (`apps/api`) son dos programas distintos.
- Cada alta crea una agencia y a esa persona como dueña.
- El dueño o un administrador pueden crear más personas dentro de la misma agencia. Cada persona confirma su correo y, al entrar, recibe otro código.
- Un agente no puede abrir la sección del equipo.
- Los datos de una agencia no se pueden leer desde otra. Eso incluye los fragmentos de documentos.

## En tu ordenador

Hace falta Node 22, pnpm y Docker.

```bash
cp .env.example .env
docker compose up
```

La web queda en http://localhost:3000 y el API en http://localhost:3001.

Sin Docker, los tests usan Postgres 16 con la extensión `vector`.

## En Render

El plan es el gratuito. La región es Fráncfort, porque Render no tiene un centro en España. La dirección pública será `*.onrender.com`.

```bash
export RENDER_API_KEY="rnd_..."
export RESEND_API_KEY="re_..."
export RESEND_FROM="CRM <tu@correo.com>"
./scripts/render-setup.sh
```

La clave de Render se crea en Account Settings → API Keys.

Resend es el servicio que manda los códigos. El plan gratuito de Render bloquea el correo clásico (puertos 25, 465 y 587), así que el envío va por la API de Resend, que usa el puerto web normal. Cuenta gratuita en https://resend.com. `RESEND_FROM` tiene que ser un remitente que Resend ya haya verificado.

## Límites del plan gratuito

- El Postgres se apaga a los 30 días. Después hay 14 días para pasarlo a un plan de pago. Si no, Render borra los datos. No hace copias de seguridad.
- La web y el API se duermen si nadie entra en 15 minutos. La primera visita después de eso tarda en responder.
- Hay 750 horas gratis al mes para todo el espacio de trabajo.
- Redis y la carpeta de archivos no están en Render en esta fase. Están en Docker, en tu ordenador, para las fases siguientes.

## Decisiones de esta fase

- Tiempo real del inbox, cuando llegue la fase 3: SSE. Es un canal en la misma página web y encaja con un solo servidor pequeño. Todavía no está construido.
- Los archivos de las agencias (PDF y propuestas) irán a una carpeta en la nube compatible con S3. En tu ordenador esa carpeta es MinIO. En Render todavía no hay carpeta, porque los documentos llegan en la fase 4.
- `webhook_events.tenant_id` puede quedar vacío. El aviso de Meta llega antes de saber qué agencia es. Una agencia no puede leer avisos de otra ni avisos sin agencia.
- Un lead puede nacer de Meta o crearse a mano. El identificador de Meta es obligatorio solo cuando viene de un anuncio.
- El consentimiento de WhatsApp saldrá de un campo del formulario de Meta. Esa conexión es la fase 2.
- Los modelos de IA se eligen en la fase 5, contra la documentación vigente. Esta fase no llama a ningún modelo.
