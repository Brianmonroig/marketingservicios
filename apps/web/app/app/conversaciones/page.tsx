import Link from "next/link";
import { Composer } from "./composer-switch";
import { apiFetch, type ConversationRow, type MessageRow, type TemplateRow } from "@/lib/api";
import { formatDateTime, formatTime, sourceLabel } from "@/lib/format";
import { LiveRefresh } from "@/components/live-refresh";
import { ThreadFeed } from "@/components/thread-feed";

type Thread = {
  conversation: { id: string; status: string; aiEnabled: boolean; lastInboundAt: string | null; windowOpen: boolean };
  lead: { id: string; name: string | null; email: string | null; phone: string | null; source: string | null; whatsappOptIn: boolean; trade: string | null; serviceArea: string | null; formAnswers: Record<string, string | string[]>; stageName: string | null };
  messages: MessageRow[];
};

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const list = await apiFetch<{ conversations: ConversationRow[] }>("/conversations");
  const conversations = list.data.conversations ?? [];
  const selectedId = c ?? conversations[0]?.id;
  const thread = selectedId ? await apiFetch<Thread>(`/conversations/${selectedId}`) : null;
  const detail = thread?.ok ? thread.data : null;

  // Las plantillas solo hacen falta cuando el texto libre no está disponible.
  const templates =
    detail && !detail.conversation.windowOpen
      ? await apiFetch<{ templates: TemplateRow[] }>("/whatsapp/templates")
      : null;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Inbox
          </p>
          <h1 className="page-title">
            <em>Conversaciones</em>.
          </h1>
        </div>
        <LiveRefresh />
      </div>

      {conversations.length === 0 ? (
        <div className="panel empty">Todavía no hay conversaciones. Aparecerán cuando un lead escriba por WhatsApp o le envíes una plantilla.</div>
      ) : (
        <div className="inbox">
          <div className="inbox-col">
            <div className="inbox-list">
              {conversations.map((conversation) => (
                <Link key={conversation.id} href={`/app/conversaciones?c=${conversation.id}`} className="inbox-item" aria-current={conversation.id === selectedId}>
                  <span className="top">
                    <span className="name">{conversation.leadName ?? conversation.leadPhone ?? "Sin nombre"}</span>
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
                  <span className={`pill ${detail.conversation.windowOpen ? "pill-ok" : "pill-warn"}`}>
                    {detail.conversation.windowOpen ? "Ventana de 24 h abierta" : "Ventana de 24 h cerrada"}
                  </span>
                </div>
                <ThreadFeed messages={detail.messages} />
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
                  <strong style={{ fontSize: "1.05rem" }}>Ficha del lead</strong>
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
                      <dt>Último mensaje del lead</dt>
                      <dd>{formatDateTime(detail.conversation.lastInboundAt)}</dd>
                    </div>
                    {Object.entries(detail.lead.formAnswers ?? {}).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key.replaceAll("_", " ")}</dt>
                        <dd>{Array.isArray(value) ? value.join(", ") : value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link className="btn btn-ghost btn-sm" href={`/app/leads/${detail.lead.id}`}>
                    Ver ficha completa
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
