import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { activatePageAction, removeIntegrationAction, startMetaConnectionAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { apiFetch, type IntegrationRow } from "@/lib/api";
import { requiredEnv } from "@/lib/env";
import { WhatsAppForm } from "./whatsapp-form";

type Setup = { metaApp: boolean; webhookVerifyToken: boolean; queue: boolean; graphVersion: string };

const statusPill: Record<string, { label: string; className: string }> = {
  active: { label: "Activa", className: "pill-ok" },
  available: { label: "Sin activar", className: "pill-warn" },
  error: { label: "Con error", className: "pill-bad" },
};

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ ok?: string; n?: string; error?: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "agent") {
    return (
      <>
        <h1 className="page-title">
          Sin <em>permiso</em>.
        </h1>
        <p className="panel-note">Las conexiones con Meta y WhatsApp son para dueños y administradores.</p>
      </>
    );
  }

  const query = await searchParams;
  const [integrations, setup] = await Promise.all([
    apiFetch<{ integrations: IntegrationRow[] }>("/integrations"),
    apiFetch<Setup>("/integrations/setup"),
  ]);
  const rows = integrations.data.integrations ?? [];
  const pages = rows.filter((row) => row.provider === "meta_page");
  const numbers = rows.filter((row) => row.provider === "whatsapp");
  const apiUrl = requiredEnv("API_URL").replace(/\/$/, "");
  const server = setup.data;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Meta · WhatsApp
          </p>
          <h1 className="page-title">
            <em>Conexiones</em>.
          </h1>
        </div>
      </div>

      {query.ok === "paginas" ? <p className="msg-ok">Facebook devolvió {query.n ?? 0} página(s). Activa la que recibe los leads.</p> : null}
      {query.ok === "pagina" ? <p className="msg-ok">Página activada. Meta enviará sus leads a esta agencia.</p> : null}
      {query.ok === "desconectado" ? <p className="msg-ok">Conexión eliminada.</p> : null}
      {query.error ? <p className="msg-error">{query.error}</p> : null}

      <div className="panel">
        <h2>Configuración del servidor</h2>
        <p className="panel-note">
          Estos valores se ponen como variables de entorno del API en Render. Aquí solo ves si están o no. Los secretos no se muestran.
        </p>
        <ul className="timeline">
          <li>
            <span className={`pill ${server.metaApp ? "pill-ok" : "pill-warn"}`}>{server.metaApp ? "Listo" : "Falta"}</span>
            <span>App de Meta: META_APP_ID y META_APP_SECRET</span>
          </li>
          <li>
            <span className={`pill ${server.webhookVerifyToken ? "pill-ok" : "pill-warn"}`}>{server.webhookVerifyToken ? "Listo" : "Falta"}</span>
            <span>Token de verificación de webhooks: META_WEBHOOK_VERIFY_TOKEN</span>
          </li>
          <li>
            <span className={`pill ${server.queue ? "pill-ok" : "pill-warn"}`}>{server.queue ? "Listo" : "Falta"}</span>
            <span>Cola de trabajos: REDIS_URL</span>
          </li>
        </ul>
        <p className="panel-note" style={{ marginTop: "1rem", marginBottom: 0 }}>
          Direcciones que hay que dar a Meta como «URL de devolución de llamada»: <br />
          <span className="mono">{apiUrl}/webhooks/meta</span> (Lead Ads) · <span className="mono">{apiUrl}/webhooks/whatsapp</span> (WhatsApp)
        </p>
      </div>

      <div className="panel">
        <h2>Página de Facebook (Lead Ads)</h2>
        <p className="panel-note">
          Inicia sesión con Facebook para elegir las páginas que gestionas. Después activa la que tiene los formularios: así Meta empieza a avisarnos de cada lead nuevo.
        </p>
        <form action={startMetaConnectionAction}>
          <Button type="submit" size="sm" disabled={!server.metaApp}>
            Conectar con Facebook <span aria-hidden="true">→</span>
          </Button>
        </form>
        {pages.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: "1.2rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Página</th>
                  <th>Id</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => {
                  const pill = statusPill[page.status] ?? { label: page.status, className: "" };
                  return (
                    <tr key={page.id}>
                      <td style={{ color: "var(--ink)" }}>{page.name ?? "Sin nombre"}</td>
                      <td className="mono">{page.externalAccountId}</td>
                      <td>
                        <span className={`pill ${pill.className}`}>{pill.label}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: ".5rem" }}>
                          {page.status !== "active" ? (
                            <form action={activatePageAction.bind(null, page.id)}>
                              <Button type="submit" size="sm">
                                Activar
                              </Button>
                            </form>
                          ) : null}
                          <form action={removeIntegrationAction.bind(null, page.id)}>
                            <Button type="submit" size="sm" variant="danger">
                              Quitar
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h2>Número de WhatsApp (Cloud API)</h2>
        <p className="panel-note">
          Escribe el id del número y el de la cuenta de WhatsApp Business que ves en el panel de Meta, junto con la clave de acceso. Meta comprueba que son válidos antes de guardar nada. La clave se guarda cifrada.
        </p>
        {numbers.map((number) => (
          <div key={number.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <span className={`pill ${(statusPill[number.status] ?? { className: "" }).className}`}>{(statusPill[number.status] ?? { label: number.status }).label}</span>
            <strong>{number.name ?? number.externalAccountId}</strong>
            <span className="mono" style={{ color: "var(--mute)" }}>
              id {number.externalAccountId}
            </span>
            <form action={removeIntegrationAction.bind(null, number.id)}>
              <Button type="submit" size="sm" variant="danger">
                Desconectar
              </Button>
            </form>
          </div>
        ))}
        {numbers.length === 0 ? <WhatsAppForm /> : null}
      </div>
    </>
  );
}
