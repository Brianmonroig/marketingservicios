import { auth } from "@/auth";
import { apiFetch, type TemplateRow } from "@/lib/api";
import { CreateTemplateForm, FirstContactForm } from "./template-forms";

type TemplatesResponse = {
  templates: TemplateRow[];
  firstContactTemplate: { name: string; language: string; params?: string[] } | null;
};

const statusPill: Record<string, string> = {
  APPROVED: "pill-ok",
  PENDING: "pill-warn",
  REJECTED: "pill-bad",
  PAUSED: "pill-bad",
};

const statusLabel: Record<string, string> = {
  APPROVED: "Aprobada",
  PENDING: "En revisión",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
};

export default async function TemplatesPage() {
  const session = await auth();
  const isManager = session?.user.role !== "agent";
  const result = await apiFetch<TemplatesResponse>("/whatsapp/templates");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            WhatsApp
          </p>
          <h1 className="page-title">
            <em>Plantillas</em>.
          </h1>
        </div>
      </div>

      {!result.ok ? (
        <div className="panel">
          <p className="msg-error">{result.data.error ?? "No se pudieron cargar las plantillas"}</p>
          {result.data.code === "no_whatsapp" ? <p className="panel-note">Conecta primero el número en la sección Conexiones.</p> : null}
        </div>
      ) : (
        <>
          <p className="panel-note">
            Fuera de la ventana de 24 h solo se pueden enviar plantillas aprobadas por Meta. La lista se lee directamente de tu cuenta de WhatsApp Business.
          </p>
          {result.data.templates.length === 0 ? (
            <div className="panel empty">Tu cuenta no tiene plantillas todavía.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Idioma</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                    <th>Texto</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.templates.map((template) => (
                    <tr key={`${template.name}-${template.language}`}>
                      <td className="mono" style={{ color: "var(--ink)" }}>
                        {template.name}
                      </td>
                      <td>{template.language}</td>
                      <td>{template.category}</td>
                      <td>
                        <span className={`pill ${statusPill[template.status] ?? ""}`}>{statusLabel[template.status] ?? template.status}</span>
                      </td>
                      <td style={{ maxWidth: 360 }}>{template.bodyText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isManager ? (
            <div className="split" style={{ marginTop: "1rem" }}>
              <div className="panel">
                <h2>Primer contacto</h2>
                <p className="panel-note">
                  Cuando registras el permiso de WhatsApp de un lead, recibe esta plantilla. Solo se envía una vez por lead.
                </p>
                <FirstContactForm templates={result.data.templates.filter((template) => template.status === "APPROVED")} current={result.data.firstContactTemplate} />
              </div>
              <div className="panel">
                <h2>Crear plantilla</h2>
                <p className="panel-note">Meta la revisa y puede tardar en aprobarla. Usa {"{{1}}"}, {"{{2}}"}… para las variables y escribe un ejemplo de cada una, una por línea.</p>
                <CreateTemplateForm />
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
