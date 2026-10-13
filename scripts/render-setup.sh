#!/usr/bin/env bash
# Crea en Render, con el plan gratuito y en Fráncfort:
#   - Postgres 16 (crm-db)
#   - API Fastify (crm-api)
#   - Web Next.js (crm-web)
#
# Endpoints usados, tomados de la API pública de Render:
#   POST /v1/postgres
#   GET  /v1/postgres/{id}/connection-info
#   POST /v1/services
#   PUT  /v1/services/{id}/env-vars
#   GET  /v1/owners
#
# Uso:
#   export RENDER_API_KEY="rnd_..."
#   export RESEND_API_KEY="re_..."          # opcional en este paso
#   export RESEND_FROM="CRM <tu@correo.com>" # opcional en este paso
#   ./scripts/render-setup.sh

set -euo pipefail

API="https://api.render.com/v1"
REPO="https://github.com/Brianmonroig/marketingservicios"

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "Falta RENDER_API_KEY."
  echo "En Render: Account Settings → API Keys → Create API Key."
  echo "Después: export RENDER_API_KEY='rnd_...' && ./scripts/render-setup.sh"
  exit 1
fi

if ! command -v node >/dev/null || ! command -v curl >/dev/null || ! command -v openssl >/dev/null; then
  echo "Hacen falta node, curl y openssl."
  exit 1
fi

render() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local tmp
  tmp="$(mktemp)"
  local code
  if [[ -n "$body" ]]; then
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      -H "Authorization: Bearer ${RENDER_API_KEY}" \
      -H "Content-Type: application/json" \
      "${API}${path}" \
      -d "$body")"
  else
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      -H "Authorization: Bearer ${RENDER_API_KEY}" \
      -H "Accept: application/json" \
      "${API}${path}")"
  fi
  if [[ "$code" -lt 200 || "$code" -ge 300 ]]; then
    echo "Render respondió ${code} en ${method} ${path}." >&2
    cat "$tmp" >&2
    rm -f "$tmp"
    exit 1
  fi
  cat "$tmp"
  rm -f "$tmp"
}

json_get() {
  node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); const path=process.argv[1].split("."); let cur=data; for (const key of path) cur=cur?.[key]; if (cur==null) process.exit(2); process.stdout.write(String(cur));' "$1"
}

echo "Buscando tu espacio de Render..."
owners="$(render GET /owners)"
owner_id="$(printf "%s" "$owners" | node -e '
const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
const row = Array.isArray(data) ? data[0] : data;
const owner = row.owner ?? row;
if (!owner?.id) {
  console.error("No pude leer el espacio de trabajo. Respuesta:");
  console.error(JSON.stringify(data).slice(0, 500));
  process.exit(1);
}
process.stdout.write(owner.id);
')"
echo "Espacio: ${owner_id}"

echo "Creando Postgres gratuito en Fráncfort (crm-db)..."
postgres="$(render POST /postgres "$(cat <<JSON
{
  "name": "crm-db",
  "ownerId": "${owner_id}",
  "plan": "free",
  "region": "frankfurt",
  "version": "16",
  "databaseName": "crm",
  "databaseUser": "crm",
  "connectionPool": "none"
}
JSON
)")"
postgres_id="$(printf "%s" "$postgres" | json_get id)"
echo "Postgres: ${postgres_id}. Esperando a que acepte conexiones..."

database_url=""
for _ in $(seq 1 60); do
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w "%{http_code}" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    "${API}/postgres/${postgres_id}/connection-info" || true)"
  if [[ "$code" == "200" ]]; then
    database_url="$(json_get internalConnectionString < "$tmp")"
    rm -f "$tmp"
    break
  fi
  rm -f "$tmp"
  sleep 5
done

if [[ -z "$database_url" ]]; then
  echo "El Postgres no llegó a estar listo. Revisa crm-db en el panel de Render."
  exit 1
fi

jwt_secret="$(openssl rand -base64 32)"
token_key="$(openssl rand -base64 32)"
auth_secret="$(openssl rand -base64 32)"

echo "Creando el API (crm-api)..."
api_service="$(render POST /services "$(node -e '
const body = {
  type: "web_service",
  name: "crm-api",
  ownerId: process.argv[1],
  repo: process.argv[2],
  branch: "main",
  autoDeployTrigger: "commit",
  serviceDetails: {
    runtime: "node",
    env: "node",
    plan: "free",
    region: "frankfurt",
    numInstances: 1,
    healthCheckPath: "/health",
    preDeployCommand: "./node_modules/.bin/pnpm --filter @crm/api db:migrate",
    envSpecificDetails: {
      buildCommand: "npm install -g pnpm@10.34.7 && pnpm install --frozen-lockfile && pnpm --filter @crm/shared build && pnpm --filter @crm/api lint",
      startCommand: "./node_modules/.bin/pnpm --filter @crm/api start"
    }
  }
};
process.stdout.write(JSON.stringify(body));
' "$owner_id" "$REPO")")"
api_id="$(printf "%s" "$api_service" | node -e '
const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
const id = data.id || data.service?.id;
if (!id) { console.error(JSON.stringify(data).slice(0, 800)); process.exit(1); }
process.stdout.write(id);
')"

echo "Creando la web (crm-web)..."
web_service="$(render POST /services "$(node -e '
const body = {
  type: "web_service",
  name: "crm-web",
  ownerId: process.argv[1],
  repo: process.argv[2],
  branch: "main",
  autoDeployTrigger: "commit",
  serviceDetails: {
    runtime: "node",
    env: "node",
    plan: "free",
    region: "frankfurt",
    numInstances: 1,
    healthCheckPath: "/",
    envSpecificDetails: {
      buildCommand: "npm install -g pnpm@10.34.7 && pnpm install --frozen-lockfile && pnpm --filter @crm/shared build && pnpm --filter @crm/web build",
      startCommand: "./node_modules/.bin/pnpm --filter @crm/web start"
    }
  }
};
process.stdout.write(JSON.stringify(body));
' "$owner_id" "$REPO")")"
web_id="$(printf "%s" "$web_service" | node -e '
const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
const id = data.id || data.service?.id;
if (!id) { console.error(JSON.stringify(data).slice(0, 800)); process.exit(1); }
process.stdout.write(id);
')"

service_url() {
  local id="$1"
  local payload
  payload="$(render GET "/services/${id}")"
  printf "%s" "$payload" | node -e '
function findUrl(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.url === "string" && value.url.startsWith("http")) return value.url;
  for (const child of Object.values(value)) {
    const found = findUrl(child);
    if (found) return found;
  }
  return "";
}
const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
const url = findUrl(data);
if (!url) process.exit(2);
process.stdout.write(url);
'
}

api_url="$(service_url "$api_id")"
web_url="$(service_url "$web_id")"

env_json="$(node -e '
const env = [
  { key: "NODE_ENV", value: "production" },
  { key: "DATABASE_URL", value: process.argv[1] },
  { key: "JWT_SECRET", value: process.argv[2] },
  { key: "TOKEN_ENCRYPTION_KEY", value: process.argv[3] },
  { key: "WEB_ORIGIN", value: process.argv[4] }
];
if (process.argv[5]) env.push({ key: "RESEND_API_KEY", value: process.argv[5] });
if (process.argv[6]) env.push({ key: "RESEND_FROM", value: process.argv[6] });
process.stdout.write(JSON.stringify(env));
' "$database_url" "$jwt_secret" "$token_key" "$web_url" "${RESEND_API_KEY:-}" "${RESEND_FROM:-}")"

render PUT "/services/${api_id}/env-vars" "$env_json" >/dev/null

web_env="$(node -e '
process.stdout.write(JSON.stringify([
  { key: "NODE_ENV", value: "production" },
  { key: "AUTH_SECRET", value: process.argv[1] },
  { key: "AUTH_TRUST_HOST", value: "true" },
  { key: "AUTH_URL", value: process.argv[2] },
  { key: "API_URL", value: process.argv[3] }
]));
' "$auth_secret" "$web_url" "$api_url")"
render PUT "/services/${web_id}/env-vars" "$web_env" >/dev/null

echo
echo "Listo. Render va a construir los dos servicios desde GitHub."
echo "Web: ${web_url}"
echo "API: ${api_url}"
echo
echo "El Postgres gratuito caduca a los 30 días y no guarda copias."
echo "Los servicios gratuitos se duermen tras 15 minutos sin visitas."
if [[ -z "${RESEND_API_KEY:-}" || -z "${RESEND_FROM:-}" ]]; then
  echo
  echo "Falta el correo. Sin RESEND_API_KEY y RESEND_FROM el registro no envía códigos."
  echo "Añádelas en el servicio crm-api, en Environment, y vuelve a desplegar."
fi
