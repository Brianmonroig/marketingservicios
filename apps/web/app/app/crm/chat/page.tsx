import Link from "next/link";
import { auth } from "@/auth";
import { Composer } from "./composer-switch";
import { CrmDemoBanner } from "@/components/crm-demo-banner";
import { apiFetch, type ConversationRow, type MessageRow, type TemplateRow } from "@/lib/api";
import { formatDateTime, formatTime, sourceLabel } from "@/lib/format";
import { LiveRefresh } from "@/components/live-refresh";
import { ThreadFeed } from "@/components/thread-feed";

type Thread = {
  conversation: {
    id: string;
    status: string;
    channel?: string;
    contactId?: string | null;
    aiEnabled: boolean;
    lastInboundAt: string | null;
    windowOpen: boolean;
  };
  lead: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    source: string | null;
    whatsappOptIn: boolean;
    trade: string | null;
    serviceArea: string | null;
    formAnswers: Record<string, string | string[]>;
    stageName: string | null;
  };
  messages: MessageRow[];
};

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ c?: string; ok?: string }> }) {
  const session = await auth();
  const isManager = session?.user.role === "owner" || session?.user.role === "admin";
  const { c, ok } = await searchParams;
  const list = await apiFetch<{ conversations: ConversationRow[] }>("/conversations");
  const conversations = list.data.conversations ?? [];
  const selectedId = c ?? conversations[0]?.id;
  const thread = selectedId ? await apiFetch<Thread>(`/conversations/${selectedId}`) : null;
  const detail = thread?.ok ? thread.data : null;
  const isDemo = detail?.conversation.channel === "demo";

  const templates =
    detail && !detail.conversation.windowOpen && !isDemo
      ? await apiFetch<{ templates: TemplateRow[] }>("/whatsapp/templates")
      : null;

  const contactHref = detail?.conversation.contactId
    ? `/app/crm/contactos/${detail.conversation.contactId}`
    : null;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            CRM · Chat
          </p>
          <h1 className="page-title">
            <em>Chat</em>.
          </h1>
        </div>
        <LiveRefresh />
      </div>

      {ok === "demo" ? (
        <p className="msg-ok">Ejemplo cargado. Este hilo es local (no WhatsApp). Desde la ficha lateral abre contacto, tickets y oportunidades.</p>
      ) : null}

      {conversations.length === 0 ? (
        <>
          <CrmDemoBanner isManager={isManager} />
          <div className="panel empty">Todavía no hay conversaciones. Carga el ejemplo o espera un WhatsApp real.</div>
        </>
      ) : (
        <div className="inbox">
          <div className="inbox-col">
            <div className="inbox-list">
              {conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/app/crm/chat?c=${conversation.id}`}
                  className="inbox-item"
                  aria-current={conversation.id === selectedId}
                >
                  <span className="top">
                    <span className="name">
                      {conversation.leadName ?? conversation.leadPhone ?? "Sin nombre"}
                      {conversation.channel === "demo" ? " · ejemplo" : ""}
                    </span>
                    <span className="when">{formatTime(conversation.lastMessageAt)}</span>
                  </span>
                  <span className="preview">
                    {conversation.lastDirection === "out" ? "Tú: " : ""}
                    {conversation.lastContent ?? ""}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {detail ? (
            <>
              <div className="inbox-col thread">
                <div className="thread-bar">
                  <div>
                    <strong>{detail.lead.name ?? detail.lead.phone}</strong>
                    <div className="mono" style={{ color: "var(--mute)" }}>
                      {detail.lead.phone}
                    </div>
                  </div>
                  <span className={`pill ${isDemo ? "pill-warn" : detail.conversation.windowOpen ? "pill-ok" : "pill-warn"}`}>
                    {isDemo
                      ? "Chat local (ejemplo)"
                      : detail.conversation.windowOpen
                        ? "Ventana de 24 h abierta"
                        : "Ventana de 24 h cerrada"}
                  </span>
                </div>
                <ThreadFeed messages={detail.messages} />
                {isDemo ? (
                  <p className="panel-note" style={{ margin: "0 .8rem" }}>
                    Mensajes guardados solo en el CRM. No se envían a WhatsApp.
                  </p>
                ) : null}
                <Composer
                  conversationId={detail.conversation.id}
                  windowOpen={detail.conversation.windowOpen}
                  canSendTemplate={detail.lead.whatsappOptIn}
                  templates={templates?.data.templates ?? []}
                  templatesError={templates && !templates.ok ? (templates.data.error ?? "No se pudieron cargar las plantillas") : null}
                />
              </div>

              <div className="inbox-col">
                <div className="lead-card">
                  <strong style={{ fontSize: "1.05rem" }}>Ficha del contacto</strong>
                  <dl>
                    <div>
                      <dt>Origen</dt>
                      <dd>{sourceLabel[detail.lead.source ?? ""] ?? detail.lead.source ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Etapa</dt>
                      <dd>{detail.lead.stageName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Correo</dt>
                      <dd>{detail.lead.email ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Oficio · zona</dt>
                      <dd>{[detail.lead.trade, detail.lead.serviceArea].filter(Boolean).join(" · ") || "—"}</dd>
                    </div>
                    <div>
                      <dt>Permiso de WhatsApp</dt>
                      <dd>{detail.lead.whatsappOptIn ? "Con permiso" : "Sin permiso"}</dd>
                    </div>
                    <div>
                      <dt>Último mensaje entrante</dt>
                      <dd>{formatDateTime(detail.conversation.lastInboundAt)}</dd>
                    </div>
                    {Object.entries(detail.lead.formAnswers ?? {}).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key.replaceAll("_", " ")}</dt>
                        <dd>{Array.isArray(value) ? value.join(", ") : value}</dd>
                      </div>
                    ))}
                  </dl>
                  {contactHref ? (
                    <Link className="btn btn-ghost btn-sm" href={contactHref}>
                      Ver ficha completa
                    </Link>
                  ) : null}
                  <Link className="btn btn-ghost btn-sm" href="/app/crm/tickets">
                    Ver tickets
                  </Link>
                  <Link className="btn btn-ghost btn-sm" href="/app/crm/oportunidades">
                    Ver oportunidades
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="inbox-col empty" style={{ gridColumn: "span 2" }}>
              {thread && !thread.ok ? (thread.data.error ?? "No se pudo abrir la conversación") : "Elige una conversación."}
            </div>
          )}
        </div>
      )}
    </>
  );
}
