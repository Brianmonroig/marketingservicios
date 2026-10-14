import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Deps } from "../deps.js";
import { extractLeadgenEvents, extractWhatsAppEvents, storeWebhookEvent, type ExtractedEvent } from "../ingest.js";
import { metaConfig, verifySignature } from "../meta.js";

const ENQUEUE_TIMEOUT_MS = 1000;

// El evento ya está guardado en la base de datos cuando llegamos aquí. Si la cola
// no responde, no hacemos esperar a Meta: el barrido lo vuelve a encolar.
async function enqueueWithoutWaiting(deps: Deps, id: string, log: FastifyRequest["log"]) {
  if (!deps.queue) return;
  const queue = deps.queue;
  await Promise.race([
    queue.enqueueWebhook(id).catch((error: unknown) => log.warn({ err: error, webhookEventId: id }, "No se pudo encolar el evento")),
    new Promise<void>((resolve) => setTimeout(resolve, ENQUEUE_TIMEOUT_MS)),
  ]);
}

function publicLimit() {
  return { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } };
}

export async function registerWebhookRoutes(app: FastifyInstance, deps: Deps) {
  await app.register(async (scope) => {
    // Para firmar hace falta el cuerpo exacto que envió Meta, sin parsear.
    scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => done(null, body));

    const verify = (request: FastifyRequest, reply: FastifyReply) => {
      const config = metaConfig();
      const query = request.query as Record<string, string | undefined>;
      if (!config.verifyToken) return reply.code(503).send({ error: "Falta META_WEBHOOK_VERIFY_TOKEN en el servidor" });
      if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === config.verifyToken && query["hub.challenge"]) {
        return reply.code(200).type("text/plain").send(query["hub.challenge"]);
      }
      return reply.code(403).send({ error: "Token de verificación incorrecto" });
    };

    const receive = (extract: (body: unknown) => ExtractedEvent[]) => async (request: FastifyRequest, reply: FastifyReply) => {
      const { appSecret } = metaConfig();
      if (!appSecret) return reply.code(503).send({ error: "Falta META_APP_SECRET en el servidor" });
      if (!deps.queue) return reply.code(503).send({ error: "La cola no está disponible" });

      const raw = request.body as Buffer;
      const signature = request.headers["x-hub-signature-256"];
      if (!Buffer.isBuffer(raw) || !verifySignature(raw, typeof signature === "string" ? signature : undefined, appSecret)) {
        return reply.code(401).send({ error: "Firma no válida" });
      }

      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        return reply.code(400).send({ error: "El cuerpo no es JSON" });
      }

      const created: string[] = [];
      for (const event of extract(body)) {
        const id = await storeWebhookEvent(deps.db, event);
        if (id) created.push(id);
      }
      await Promise.all(created.map((id) => enqueueWithoutWaiting(deps, id, request.log)));
      return reply.code(200).send({ ok: true });
    };

    scope.get("/webhooks/meta", publicLimit(), verify);
    scope.post("/webhooks/meta", publicLimit(), receive(extractLeadgenEvents));
    scope.get("/webhooks/whatsapp", publicLimit(), verify);
    scope.post("/webhooks/whatsapp", publicLimit(), receive(extractWhatsAppEvents));
  });
}
