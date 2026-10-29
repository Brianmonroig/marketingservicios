import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { sourceLabel } from "@/lib/format";
import { TicketCreateForm, TicketStatusForm } from "./ticket-forms";

const stages = [
  { key: "nuevo", label: "Nuevo" },
  { key: "abierto", label: "Abierto" },
  { key: "pendiente", label: "Pendiente" },
  { key: "resuelto", label: "Resuelto" },
  { key: "cerrado", label: "Cerrado" },
] as const;

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string | null;
  contactId: string;
  contactName: string | null;
  conversationId: string | null;
};

type Contact = { id: string; name: string | null; phone: string | null };

export default async function TicketsPage() {
  const [ticketsResult, contactsResult] = await Promise.all([
    apiFetch<{ tickets: Ticket[] }>("/tickets"),
    apiFetch<{ contacts: Contact[] }>("/contacts"),
  ]);
  const tickets = ticketsResult.data.tickets ?? [];
  const contacts = contactsResult.data.contacts ?? [];

  const grouped = new Map<string, Ticket[]>();
  for (const stage of stages) grouped.set(stage.key, []);
  for (const ticket of tickets) {
    const key = grouped.has(ticket.status) ? ticket.status : "nuevo";
    grouped.get(key)!.push(ticket);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            CRM · Tickets
          </p>
          <h1 className="page-title">
            <em>Tickets</em>.
          </h1>
        </div>
      </div>

      <p className="panel-note">
        Casos ligados a <Link href="/app/crm/contactos">contactos</Link> y, si aplica, al{" "}
        <Link href="/app/crm/chat">Chat</Link>. Persistidos en base de datos.
      </p>

      <div className="panel" style={{ marginBottom: "1.2rem", maxWidth: 720 }}>
        <h2>Nuevo ticket</h2>
        <TicketCreateForm contacts={contacts} />
      </div>

      {!ticketsResult.ok ? <p className="msg-error">{ticketsResult.data.error ?? "No se pudieron cargar los tickets"}</p> : null}

      <div className="board">
        {stages.map((stage) => {
          const cards = grouped.get(stage.key) ?? [];
          return (
            <section key={stage.key} className="board-col">
              <header>
                <h2>{stage.label}</h2>
                <span className="mono">{cards.length}</span>
              </header>
              {cards.length === 0 ? (
                <div className="board-empty">Sin tickets</div>
              ) : (
                <ul className="board-cards">
                  {cards.map((ticket) => (
                    <li key={ticket.id} className="board-card" style={{ display: "grid", gap: ".5rem" }}>
                      <strong>{ticket.title}</strong>
                      <span>
                        <Link href={`/app/crm/contactos/${ticket.contactId}`}>{ticket.contactName ?? "Contacto"}</Link>
                        {ticket.source ? ` · ${sourceLabel[ticket.source] ?? ticket.source}` : ""}
                      </span>
                      {ticket.description ? <span className="panel-note" style={{ margin: 0 }}>{ticket.description}</span> : null}
                      {ticket.conversationId ? (
                        <Link className="btn btn-ghost btn-sm" href={`/app/crm/chat?c=${ticket.conversationId}`}>
                          Ver chat
                        </Link>
                      ) : null}
                      <TicketStatusForm ticket={ticket} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
