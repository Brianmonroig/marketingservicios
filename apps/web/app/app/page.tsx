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

  const activePages = integrations?.data.integrations?.filter((item) => item.provider === "meta_page" && item.status === "active").length ?? 0;
  const whatsapp = integrations?.data.integrations?.some((item) => item.provider === "whatsapp" && item.status === "active") ?? false;
  const openWindows = conversations.data.conversations?.filter((item) => item.windowOpen).length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            {session?.user.agencyName}
          </p>
          <h1 className="page-title">
            Tu <em>resumen</em>.
          </h1>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span className="mono">Leads</span>
          <strong>{leads.data.leads?.length ?? 0}</strong>
        </div>
        <div className="stat">
          <span className="mono">Conversaciones</span>
          <strong>{conversations.data.conversations?.length ?? 0}</strong>
        </div>
        <div className="stat">
          <span className="mono">Ventanas de 24 h abiertas</span>
          <strong>{openWindows}</strong>
        </div>
        {isManager ? (
          <div className="stat">
            <span className="mono">Páginas activas</span>
            <strong>{activePages}</strong>
          </div>
        ) : null}
      </div>

      {isManager && (!whatsapp || activePages === 0) ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h2>Para empezar a recibir leads</h2>
          <p className="panel-note">Faltan conexiones. Hasta que las completes no entrarán leads ni mensajes.</p>
          <ul className="timeline">
            <li>
              <span className={`pill ${activePages > 0 ? "pill-ok" : "pill-warn"}`}>{activePages > 0 ? "Hecho" : "Pendiente"}</span>
              <span>Conectar y activar una página de Facebook</span>
            </li>
            <li>
              <span className={`pill ${whatsapp ? "pill-ok" : "pill-warn"}`}>{whatsapp ? "Hecho" : "Pendiente"}</span>
              <span>Conectar el número de WhatsApp</span>
            </li>
          </ul>
          <div className="btn-link-row" style={{ marginTop: "1rem" }}>
            <Link className="btn btn-primary btn-sm" href="/app/integraciones">
              Ir a Conexiones <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : null}

      {!isManager ? (
        <p className="panel-note" style={{ marginTop: "1.2rem" }}>
          Puedes trabajar los leads y las conversaciones de la agencia. La gestión del equipo y de las conexiones está reservada a dueños y administradores.
        </p>
      ) : null}
    </>
  );
}
