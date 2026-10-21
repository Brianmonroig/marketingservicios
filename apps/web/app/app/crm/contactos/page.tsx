import Link from "next/link";
import { apiFetch, type LeadRow } from "@/lib/api";
import { formatDate, sourceLabel } from "@/lib/format";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const result = await apiFetch<{ leads: LeadRow[] }>(`/leads${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const leads = result.data.leads ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            {leads.length} {leads.length === 1 ? "contacto" : "contactos"}
          </p>
          <h1 className="page-title">
            Tus <em>contactos</em>.
          </h1>
        </div>
        <form className="field" style={{ minWidth: 260 }} action="/app/crm/contactos">
          <label htmlFor="q">Buscar</label>
          <input className="input" id="q" name="q" defaultValue={q ?? ""} placeholder="Nombre, teléfono o correo" />
        </form>
      </div>

      {result.ok ? (
        leads.length === 0 ? (
          <div className="panel empty">
            {q ? "Ningún contacto coincide con la búsqueda." : "Todavía no hay contactos. Llegarán cuando conectes una página de Facebook o te escriban por WhatsApp."}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Origen</th>
                  <th>Etapa</th>
                  <th>WhatsApp</th>
                  <th>Alta</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link className="row-link" href={`/app/crm/contactos/${lead.id}`}>
                        {lead.name ?? "Sin nombre"}
                      </Link>
                      {lead.email ? <div style={{ fontSize: ".8rem", color: "var(--mute)" }}>{lead.email}</div> : null}
                    </td>
                    <td className="mono" style={{ fontSize: ".82rem" }}>
                      {lead.phone ?? "—"}
                    </td>
                    <td>
                      <span className="pill">{sourceLabel[lead.source ?? ""] ?? lead.source ?? "—"}</span>
                    </td>
                    <td>{lead.stageName ?? "—"}</td>
                    <td>
                      <span className={`pill ${lead.whatsappOptIn ? "pill-ok" : "pill-mute"}`}>{lead.whatsappOptIn ? "Con permiso" : "Sin permiso"}</span>
                    </td>
                    <td>{formatDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <p className="msg-error">{result.data.error ?? "No se pudieron cargar los leads"}</p>
      )}
    </>
  );
}
