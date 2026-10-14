import { createHmac, timingSafeEqual } from "node:crypto";

// Cliente de la Graph API de Meta. La versión sale de META_GRAPH_VERSION porque no
// he podido confirmarla contra la documentación oficial (Meta bloquea la lectura
// automática). Ver docs/PENDIENTES.md.
export const DEFAULT_GRAPH_VERSION = "v25.0";

// Permisos que pide el login de Facebook para conectar una página de Lead Ads.
// Lista tomada de fuentes secundarias, sin confirmar contra la documentación oficial.
export const META_PAGE_SCOPES = [
  "leads_retrieval",
  "pages_manage_metadata",
  "pages_show_list",
  "pages_read_engagement",
  "ads_management",
] as const;

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
  }

  // Los fallos de red, el límite de uso y los 5xx merecen reintento. El resto no.
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export type MetaLeadField = { name: string; values: string[] };

export type MetaLead = {
  id: string;
  createdTime?: string;
  adId?: string;
  adsetId?: string;
  campaignId?: string;
  formId?: string;
  fields: MetaLeadField[];
};

export type MetaPage = { id: string; name: string; accessToken: string };

export type WhatsAppSendInput =
  | { to: string; type: "text"; text: string }
  | { to: string; type: "template"; name: string; language: string; params: string[] };

export type WhatsAppTemplate = {
  id?: string;
  name: string;
  language: string;
  status: string;
  category: string;
  bodyText: string;
};

export type CreateTemplateInput = {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  bodyText: string;
  bodyExamples: string[];
};

export type MetaClient = {
  buildOAuthUrl(input: { redirectUri: string; state: string }): string;
  exchangeCodeForLongLivedToken(input: { code: string; redirectUri: string }): Promise<{ accessToken: string; expiresAt: Date | null }>;
  listPages(userToken: string): Promise<MetaPage[]>;
  subscribePage(pageId: string, pageToken: string): Promise<void>;
  unsubscribePage(pageId: string, pageToken: string): Promise<void>;
  getLead(leadgenId: string, pageToken: string): Promise<MetaLead>;
  getPhoneNumber(phoneNumberId: string, token: string): Promise<{ displayPhoneNumber: string; verifiedName?: string }>;
  sendWhatsApp(phoneNumberId: string, token: string, input: WhatsAppSendInput): Promise<{ messageId: string }>;
  listTemplates(wabaId: string, token: string): Promise<WhatsAppTemplate[]>;
  createTemplate(wabaId: string, token: string, input: CreateTemplateInput): Promise<{ id: string; status: string }>;
};

export function metaConfig() {
  return {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
    version: process.env.META_GRAPH_VERSION ?? DEFAULT_GRAPH_VERSION,
  };
}

// Firma X-Hub-Signature-256: HMAC-SHA256 del cuerpo sin tocar, con el secreto de la app.
export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = header.slice("sha256=".length);
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

type GraphError = { error?: { message?: string; code?: number } };

export function createHttpMetaClient(fetchImpl: typeof fetch = fetch): MetaClient {
  const config = metaConfig();
  const base = `https://graph.facebook.com/${config.version}`;

  function requireApp(): { appId: string; appSecret: string } {
    if (!config.appId || !config.appSecret) {
      throw new MetaApiError("Faltan META_APP_ID y META_APP_SECRET en el servidor", 503);
    }
    return { appId: config.appId, appSecret: config.appSecret };
  }

  async function call<T>(path: string, init: { method?: string; token?: string; query?: Record<string, string>; json?: unknown } = {}): Promise<T> {
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
    const headers: Record<string, string> = {};
    if (init.token) headers.authorization = `Bearer ${init.token}`;
    if (init.json !== undefined) headers["content-type"] = "application/json";

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: init.method ?? "GET",
        headers,
        body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new MetaApiError(`No se pudo conectar con Meta: ${(error as Error).message}`, 0);
    }
    const data = (await response.json().catch(() => ({}))) as GraphError & T;
    if (!response.ok) {
      throw new MetaApiError(data.error?.message ?? `Meta respondió ${response.status}`, response.status, data.error?.code);
    }
    return data;
  }

  return {
    buildOAuthUrl({ redirectUri, state }) {
      const { appId } = requireApp();
      const url = new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
      url.searchParams.set("client_id", appId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("scope", META_PAGE_SCOPES.join(","));
      url.searchParams.set("response_type", "code");
      return url.toString();
    },

    async exchangeCodeForLongLivedToken({ code, redirectUri }) {
      const { appId, appSecret } = requireApp();
      const short = await call<{ access_token: string }>("/oauth/access_token", {
        query: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code },
      });
      const long = await call<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
        query: {
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: short.access_token,
        },
      });
      return {
        accessToken: long.access_token,
        expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
      };
    },

    async listPages(userToken) {
      const pages: MetaPage[] = [];
      let next: string | undefined = "/me/accounts";
      let query: Record<string, string> | undefined = { fields: "id,name,access_token", limit: "100" };
      while (next) {
        const page: { data?: Array<{ id: string; name: string; access_token?: string }>; paging?: { cursors?: { after?: string }; next?: string } } = await call(next, {
          token: userToken,
          query,
        });
        for (const item of page.data ?? []) {
          if (item.access_token) pages.push({ id: item.id, name: item.name, accessToken: item.access_token });
        }
        const after = page.paging?.next ? page.paging.cursors?.after : undefined;
        if (after) query = { fields: "id,name,access_token", limit: "100", after };
        else next = undefined;
      }
      return pages;
    },

    async subscribePage(pageId, pageToken) {
      await call(`/${pageId}/subscribed_apps`, {
        method: "POST",
        token: pageToken,
        query: { subscribed_fields: "leadgen" },
      });
    },

    async unsubscribePage(pageId, pageToken) {
      await call(`/${pageId}/subscribed_apps`, { method: "DELETE", token: pageToken });
    },

    async getLead(leadgenId, pageToken) {
      const data = await call<{
        id: string;
        created_time?: string;
        ad_id?: string;
        adset_id?: string;
        campaign_id?: string;
        form_id?: string;
        field_data?: MetaLeadField[];
      }>(`/${leadgenId}`, {
        token: pageToken,
        query: { fields: "created_time,ad_id,adset_id,campaign_id,form_id,field_data" },
      });
      return {
        id: data.id,
        createdTime: data.created_time,
        adId: data.ad_id,
        adsetId: data.adset_id,
        campaignId: data.campaign_id,
        formId: data.form_id,
        fields: data.field_data ?? [],
      };
    },

    async getPhoneNumber(phoneNumberId, token) {
      const data = await call<{ display_phone_number: string; verified_name?: string }>(`/${phoneNumberId}`, {
        token,
        query: { fields: "display_phone_number,verified_name" },
      });
      return { displayPhoneNumber: data.display_phone_number, verifiedName: data.verified_name };
    },

    async sendWhatsApp(phoneNumberId, token, input) {
      const body =
        input.type === "text"
          ? {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: input.to,
              type: "text",
              text: { body: input.text },
            }
          : {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: input.to,
              type: "template",
              template: {
                name: input.name,
                language: { code: input.language },
                ...(input.params.length > 0
                  ? {
                      components: [
                        {
                          type: "body",
                          parameters: input.params.map((text) => ({ type: "text", text })),
                        },
                      ],
                    }
                  : {}),
              },
            };
      const data = await call<{ messages?: Array<{ id: string }> }>(`/${phoneNumberId}/messages`, {
        method: "POST",
        token,
        json: body,
      });
      const messageId = data.messages?.[0]?.id;
      if (!messageId) throw new MetaApiError("Meta aceptó el envío pero no devolvió el id del mensaje", 502);
      return { messageId };
    },

    async listTemplates(wabaId, token) {
      const result: WhatsAppTemplate[] = [];
      let after: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const data: {
          data?: Array<{
            id?: string;
            name: string;
            language: string;
            status: string;
            category: string;
            components?: Array<{ type: string; text?: string }>;
          }>;
          paging?: { cursors?: { after?: string }; next?: string };
        } = await call(`/${wabaId}/message_templates`, {
          token,
          query: {
            fields: "id,name,language,status,category,components",
            limit: "100",
            ...(after ? { after } : {}),
          },
        });
        for (const item of data.data ?? []) {
          result.push({
            id: item.id,
            name: item.name,
            language: item.language,
            status: item.status,
            category: item.category,
            bodyText: item.components?.find((component) => component.type === "BODY")?.text ?? "",
          });
        }
        after = data.paging?.next ? data.paging.cursors?.after : undefined;
        if (!after) break;
      }
      return result;
    },

    async createTemplate(wabaId, token, input) {
      const body: Record<string, unknown> = { type: "BODY", text: input.bodyText };
      if (input.bodyExamples.length > 0) body.example = { body_text: [input.bodyExamples] };
      const data = await call<{ id: string; status: string }>(`/${wabaId}/message_templates`, {
        method: "POST",
        token,
        json: {
          name: input.name,
          language: input.language,
          category: input.category,
          components: [body],
        },
      });
      return { id: data.id, status: data.status };
    },
  };
}
