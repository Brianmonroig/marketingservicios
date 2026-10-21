import Link from "next/link";
import { auth } from "@/auth";
import { apiFetch, type ConversationRow, type IntegrationRow, type LeadRow } from "@/lib/api";

export default async function DashboardPage() {
  const session = await auth();
  const isManager = session?.user.role !== "agent";
  const [leads, conversations, integrations] = await Promise.all([
    apiFetch<{ leads: LeadRow[] }>("/leads"),
    apiFetch<{ conversations: ConversationRow[] }>("/conversations"),
    isManager ? apiFetch<{ integrations: IntegrationRow[] }>("/integrations") : Promise.resolve(null),
  ]);

  const leadList = leads.data.leads ?? [];
  const chatList = conversations.data.conversations ?? [];
  const activePages = integrations?.data.integrations?.filter((item) => item.provider === "meta_page" && item.status === "active").length ?? 0;
  const whatsapp = integrations?.data.integrations?.some((item) => item.provider === "whatsapp" && item.status === "active") ?? false;
  const openWindows = chatList.filter((item) => item.windowOpen).length;
  const byStage = new Map<string, number>();
  for (const lead of leadList) {
    const key = lead.stageName ?? "Sin etapa";
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

      <div className="stat-grid">
        <Link className="stat stat-link" href="/app/crm/contactos">
          <span className="mono">Contactos</span>
          <strong>{leadList.length}</strong>
        </Link>
        <Link className="stat stat-link" href="/app/crm/chat">
          <span className="mono">Chats</span>
          <strong>{chatList.length}</strong>
        </Link>
        <div className="stat">
          <span className="mono">Ventanas 24 h</span>
          <strong>{openWindows}</strong>
        </div>
        <div className="stat">
          <span className="mono">Tickets</span>
          <strong>0</strong>
          <span className="stat-hint">Próximamente con persistencia</span>
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
          <h2>Contactos por etapa</h2>
          <p className="panel-note">Embudo actual (pipeline de contactos). Las oportunidades usarán el mismo criterio.</p>
          {stageRows.length === 0 ? (
            <p className="empty">Sin contactos todavía.</p>
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
          <h2>Módulos</h2>
          <ul className="timeline">
            <li>
              <span className="pill pill-ok">Activo</span>
              <span>CRM · Chat, Contactos</span>
            </li>
            <li>
              <span className="pill pill-warn">UI lista</span>
              <span>CRM · Tickets y Oportunidades (tablero)</span>
            </li>
            <li>
              <span className="pill pill-mute">Futuro</span>
              <span>Calendario, automatizaciones, marketing (estilo GHL)</span>
            </li>
          </ul>
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
