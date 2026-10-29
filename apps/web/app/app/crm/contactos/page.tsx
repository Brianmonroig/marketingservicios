import Link from "next/link";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";
import { formatDate, sourceLabel } from "@/lib/format";
import { ContactCreateForm } from "./contact-create-form";
import { DemoSeedButton } from "./demo-seed-button";

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

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const session = await auth();
  const { q, ok, error } = await searchParams;
  const result = await apiFetch<{ contacts: ContactRow[] }>(`/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const contacts = result.data.contacts ?? [];
  const isManager = session?.user.role === "owner" || session?.user.role === "admin";

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
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "end" }}>
          {isManager ? <DemoSeedButton /> : null}
          <form className="field" style={{ minWidth: 220 }} action="/app/crm/contactos">
            <label htmlFor="q">Buscar</label>
            <input className="input" id="q" name="q" defaultValue={q ?? ""} placeholder="Nombre, teléfono o correo" />
          </form>
        </div>
      </div>

      {ok === "demo" ? <p className="msg-ok">Ejemplo CRM cargado (contactos, oportunidades, tickets y chat local).</p> : null}
      {ok === "demo-ya" ? <p className="msg-ok">El ejemplo ya estaba cargado en esta agencia.</p> : null}
      {error ? <p className="msg-error">{error}</p> : null}

      <div className="split" style={{ marginBottom: "1.2rem" }}>
        <div className="panel">
          <h2>Nuevo contacto</h2>
          <ContactCreateForm />
        </div>
        <div className="panel">
          <h2>Cómo se articula</h2>
          <p className="panel-note">
            Un contacto puede tener <Link href="/app/crm/oportunidades">oportunidades</Link>,{" "}
            <Link href="/app/crm/tickets">tickets</Link> y un hilo en el <Link href="/app/crm/chat">Chat</Link>. El botón
            «Cargar ejemplo CRM» rellena un caso completo sin conectar Meta ni WhatsApp.
          </p>
        </div>
      </div>

      {result.ok ? (
        contacts.length === 0 ? (
          <div className="panel empty">
            {q
              ? "Ningún contacto coincide con la búsqueda."
              : "Todavía no hay contactos. Crea uno o carga el ejemplo CRM."}
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
                      <span className={`pill ${contact.source === "demo" ? "pill-warn" : ""}`}>
                        {sourceLabel[contact.source ?? ""] ?? contact.source ?? "—"}
                      </span>
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
