import {
  MetaApiError,
  type CreateTemplateInput,
  type MetaClient,
  type MetaLead,
  type MetaPage,
  type WhatsAppSendInput,
  type WhatsAppTemplate,
} from "./meta.js";

// MOCK SOLO PARA TESTS. No habla con Meta. Ninguna pantalla ni script lo importa.
export type MetaMock = MetaClient & {
  leads: Map<string, MetaLead>;
  pages: MetaPage[];
  templates: WhatsAppTemplate[];
  sent: Array<{ phoneNumberId: string; token: string; input: WhatsAppSendInput }>;
  subscribed: string[];
  // Cuántos envíos tienen que fallar con 503 antes de que uno salga bien.
  failNextSends: number;
  createdTemplates: CreateTemplateInput[];
};

export function createMetaMock(): MetaMock {
  let counter = 0;
  const mock: MetaMock = {
    leads: new Map(),
    pages: [],
    templates: [],
    sent: [],
    subscribed: [],
    failNextSends: 0,
    createdTemplates: [],

    buildOAuthUrl({ redirectUri, state }) {
      return `https://mock.invalid/oauth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    },
    async exchangeCodeForLongLivedToken({ code }) {
      if (code !== "codigo-valido") throw new MetaApiError("Código de autorización no válido", 400);
      return { accessToken: "token-usuario-largo", expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000) };
    },
    async listPages() {
      return mock.pages;
    },
    async subscribePage(pageId) {
      mock.subscribed.push(pageId);
    },
    async unsubscribePage(pageId) {
      mock.subscribed = mock.subscribed.filter((id) => id !== pageId);
    },
    async getLead(leadgenId) {
      const lead = mock.leads.get(leadgenId);
      if (!lead) throw new MetaApiError("Lead no encontrado", 400);
      return lead;
    },
    async getPhoneNumber(phoneNumberId, token) {
      if (token === "token-malo") throw new MetaApiError("Token no válido", 401, 190);
      return { displayPhoneNumber: `+34 600 000 ${phoneNumberId.slice(-3)}`, verifiedName: "Agencia de pruebas" };
    },
    async sendWhatsApp(phoneNumberId, token, input) {
      if (mock.failNextSends > 0) {
        mock.failNextSends -= 1;
        throw new MetaApiError("Servicio no disponible", 503);
      }
      mock.sent.push({ phoneNumberId, token, input });
      counter += 1;
      return { messageId: `wamid.mock-${Date.now()}-${counter}` };
    },
    async listTemplates() {
      return mock.templates;
    },
    async createTemplate(_wabaId, _token, input) {
      mock.createdTemplates.push(input);
      return { id: `tpl-${mock.createdTemplates.length}`, status: "PENDING" };
    },
  };
  return mock;
}
