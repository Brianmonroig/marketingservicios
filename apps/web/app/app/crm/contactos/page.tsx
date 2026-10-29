import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatDate, sourceLabel } from "@/lib/format";

type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  whatsappOptIn: boolean;
  createdAt: string;
  legacyLeadId: string | null;
};

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const result = await apiFetch<{ contacts: ContactRow[] }>(`/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const contacts = result.data.contacts ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"}
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
        contacts.length === 0 ? (
          <div className="panel empty">
            {q
              ? "Ningún contacto coincide con la búsqueda."
              : "Todavía no hay contactos. Llegarán cuando conectes una página de Facebook o te escriban por WhatsApp."}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Origen</th>
                  <th>WhatsApp</th>
                  <th>Alta</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <Link className="row-link" href={`/app/crm/contactos/${contact.id}`}>
                        {contact.name ?? "Sin nombre"}
                      </Link>
                      {contact.email ? <div style={{ fontSize: ".8rem", color: "var(--mute)" }}>{contact.email}</div> : null}
                    </td>
                    <td className="mono" style={{ fontSize: ".82rem" }}>
                      {contact.phone ?? "—"}
                    </td>
                    <td>
                      <span className="pill">{sourceLabel[contact.source ?? ""] ?? contact.source ?? "—"}</span>
                    </td>
                    <td>
                      <span className={`pill ${contact.whatsappOptIn ? "pill-ok" : "pill-mute"}`}>
                        {contact.whatsappOptIn ? "Con permiso" : "Sin permiso"}
                      </span>
                    </td>
                    <td>{formatDate(contact.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <p className="msg-error">{result.data.error ?? "No se pudieron cargar los contactos"}</p>
      )}
    </>
  );
}
