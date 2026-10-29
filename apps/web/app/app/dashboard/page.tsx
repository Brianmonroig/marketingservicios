import Link from "next/link";
import { auth } from "@/auth";
import { CrmDemoBanner } from "@/components/crm-demo-banner";
import { apiFetch, type ConversationRow, type IntegrationRow } from "@/lib/api";

type ContactRow = { id: string; source: string | null };
type Opportunity = { id: string; stageName: string | null; source: string | null };
type Ticket = { id: string; status: string; source: string | null };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const { error } = await searchParams;
  const isManager = session?.user.role !== "agent";
  const [contacts, opportunities, tickets, conversations, integrations] = await Promise.all([
    apiFetch<{ contacts: ContactRow[] }>("/contacts"),
    apiFetch<{ opportunities: Opportunity[] }>("/opportunities"),
    apiFetch<{ tickets: Ticket[] }>("/tickets"),
    apiFetch<{ conversations: ConversationRow[] }>("/conversations"),
    isManager ? apiFetch<{ integrations: IntegrationRow[] }>("/integrations") : Promise.resolve(null),
  ]);

  const contactList = contacts.data.contacts ?? [];
  const oppList = opportunities.data.opportunities ?? [];
  const ticketList = tickets.data.tickets ?? [];
  const chatList = conversations.data.conversations ?? [];
  const activePages = integrations?.data.integrations?.filter((item) => item.provider === "meta_page" && item.status === "active").length ?? 0;
  const whatsapp = integrations?.data.integrations?.some((item) => item.provider === "whatsapp" && item.status === "active") ?? false;
  const openWindows = chatList.filter((item) => item.windowOpen).length;
  const crmEmpty = contactList.length === 0 && oppList.length === 0 && ticketList.length === 0 && chatList.length === 0;

  const byStage = new Map<string, number>();
  for (const item of oppList) {
    const key = item.stageName ?? "Sin etapa";
    byStage.set(key, (byStage.get(key) ?? 0) + 1);
  }
  const stageRows = [...byStage.entries()].sort((a, b) => b[1] - a[1]);
  const maxStage = Math.max(1, ...stageRows.map((row) => row[1]));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Dashboard
          </p>
          <h1 className="page-title">
            Vista <em>general</em>.
          </h1>
        </div>
      </div>

      {error ? <p className="msg-error">{error}</p> : null}
      {crmEmpty ? <CrmDemoBanner isManager={isManager} /> : null}

      <div className="stat-grid">
        <Link className="stat stat-link" href="/app/crm/contactos">
          <span className="mono">Contactos</span>
          <strong>{contactList.length}</strong>
        </Link>
        <Link className="stat stat-link" href="/app/crm/oportunidades">
          <span className="mono">Oportunidades</span>
          <strong>{oppList.length}</strong>
        </Link>
        <Link className="stat stat-link" href="/app/crm/tickets">
          <span className="mono">Tickets</span>
          <strong>{ticketList.length}</strong>
        </Link>
        <Link className="stat stat-link" href="/app/crm/chat">
          <span className="mono">Chats</span>
          <strong>{chatList.length}</strong>
        </Link>
        <div className="stat">
          <span className="mono">Ventanas 24 h</span>
          <strong>{openWindows}</strong>
        </div>
        {isManager ? (
          <div className="stat">
            <span className="mono">Páginas Meta</span>
            <strong>{activePages}</strong>
          </div>
        ) : null}
      </div>

      <div className="two-col" style={{ marginTop: "1rem" }}>
        <div className="panel">
          <h2>Oportunidades por etapa</h2>
          <p className="panel-note">Embudo real desde la tabla de oportunidades.</p>
          {stageRows.length === 0 ? (
            <p className="empty">Sin oportunidades. Carga el ejemplo CRM o crea una en Oportunidades.</p>
          ) : (
            <ul className="bar-list">
              {stageRows.map(([name, count]) => (
                <li key={name}>
                  <div className="bar-meta">
                    <span>{name}</span>
                    <span className="mono">{count}</span>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: `${(count / maxStage) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel">
          <h2>Módulos CRM</h2>
          <ul className="timeline">
            <li>
              <span className="pill pill-ok">Activo</span>
              <span>
                <Link href="/app/crm/chat">Chat</Link>, <Link href="/app/crm/contactos">Contactos</Link>,{" "}
                <Link href="/app/crm/oportunidades">Oportunidades</Link>, <Link href="/app/crm/tickets">Tickets</Link>
              </span>
            </li>
            <li>
              <span className="pill">Demo</span>
              <span>Ejemplo local sin Meta/WhatsApp (botón «Cargar ejemplo CRM»).</span>
            </li>
            <li>
              <span className="pill pill-mute">Futuro</span>
              <span>Calendario, automatizaciones, marketing</span>
            </li>
          </ul>
          {!crmEmpty && isManager ? (
            <div style={{ marginTop: "1rem" }}>
              <CrmDemoBanner isManager={isManager} compact />
            </div>
          ) : null}
          {isManager && (!whatsapp || activePages === 0) ? (
            <div className="btn-link-row" style={{ marginTop: "1rem" }}>
              <Link className="btn btn-primary btn-sm" href="/app/configuracion/integraciones">
                Completar integraciones <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
