import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDateTime, sourceLabel } from "@/lib/format";
import { ContactEditForm } from "./contact-edit-form";
import { OptInForm } from "./opt-in-form";

type ContactDetail = {
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    source: string | null;
    whatsappOptIn: boolean;
    optInAt: string | null;
    trade: string | null;
    serviceArea: string | null;
    formAnswers: Record<string, string | string[]>;
    createdAt: string;
    legacyLeadId: string | null;
  };
  opportunities: Array<{
    id: string;
    name: string | null;
    status: string;
    stageName: string | null;
    amount: string | null;
    currency: string;
  }>;
  tickets?: Array<{ id: string; title: string; status: string; priority: string }>;
  conversationId: string | null;
};

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiFetch<ContactDetail>(`/contacts/${id}`);
  if (result.status === 404 || !result.data.contact) notFound();
  const { contact, opportunities, conversationId } = result.data;
  const tickets = result.data.tickets ?? [];
  const answers = Object.entries(contact.formAnswers ?? {});

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            {sourceLabel[contact.source ?? ""] ?? contact.source ?? "Contacto"}
            {contact.source === "demo" ? " · datos de ejemplo" : ""}
          </p>
          <h1 className="page-title">{contact.name ?? "Sin nombre"}</h1>
        </div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          {conversationId ? (
            <Link className="btn btn-primary btn-sm" href={`/app/crm/chat?c=${conversationId}`}>
              Abrir chat <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          <Link className="btn btn-sm" href="/app/crm/oportunidades">
            Oportunidades
          </Link>
          <Link className="btn btn-sm" href="/app/crm/tickets">
            Tickets
          </Link>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="panel">
            <h2>Editar contacto</h2>
            <ContactEditForm
              contactId={contact.id}
              initial={{
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                trade: contact.trade,
                serviceArea: contact.serviceArea,
              }}
            />
          </div>

          <div className="panel">
            <h2>Datos</h2>
            <dl className="lead-card" style={{ padding: 0 }}>
              <div>
                <dt>Teléfono</dt>
                <dd>{contact.phone ?? "Sin teléfono válido"}</dd>
              </div>
              <div>
                <dt>Correo</dt>
                <dd>{contact.email ?? "—"}</dd>
              </div>
              <div>
                <dt>Oficio</dt>
                <dd>{contact.trade ?? "—"}</dd>
              </div>
              <div>
                <dt>Zona de cobertura</dt>
                <dd>{contact.serviceArea ?? "—"}</dd>
              </div>
              <div>
                <dt>Alta</dt>
                <dd>{formatDateTime(contact.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div>
          <div className="panel">
            <h2>Permiso de WhatsApp</h2>
            <p className="panel-note">
              {contact.whatsappOptIn
                ? `Con permiso desde ${formatDateTime(contact.optInAt)}.`
                : "Sin permiso registrado. Hace falta para enviarle una plantilla."}
            </p>
            {contact.legacyLeadId ? (
              <OptInForm leadId={contact.legacyLeadId} current={contact.whatsappOptIn} />
            ) : (
              <p className="panel-note">Este contacto no tiene lead legado.</p>
            )}
          </div>

          {opportunities.length > 0 ? (
            <div className="panel">
              <h2>Oportunidades</h2>
              <ul className="timeline" style={{ marginTop: ".6rem" }}>
                {opportunities.map((opp) => (
                  <li key={opp.id}>
                    <span className="pill">{opp.status}</span>
                    <span>
                      {opp.name ?? "Sin nombre"}
                      {opp.stageName ? ` · ${opp.stageName}` : ""}
                      {opp.amount ? ` · ${opp.amount} ${opp.currency}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="panel-note" style={{ marginBottom: 0 }}>
                <Link href="/app/crm/oportunidades">Ver embudo</Link>
              </p>
            </div>
          ) : null}

          {tickets.length > 0 ? (
            <div className="panel">
              <h2>Tickets</h2>
              <ul className="timeline" style={{ marginTop: ".6rem" }}>
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <span className="pill">{ticket.status}</span>
                    <span>
                      {ticket.title} · {ticket.priority}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="panel-note" style={{ marginBottom: 0 }}>
                <Link href="/app/crm/tickets">Ver tablero</Link>
              </p>
            </div>
          ) : null}

          {answers.length > 0 ? (
            <div className="panel">
              <h2>Respuestas del formulario</h2>
              <dl className="lead-card" style={{ padding: 0, marginTop: ".6rem" }}>
                {answers.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{Array.isArray(value) ? value.join(", ") : value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
