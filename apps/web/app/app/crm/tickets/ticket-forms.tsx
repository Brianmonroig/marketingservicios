"use client";

import { useActionState } from "react";
import { createTicketAction, updateTicketAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

type Contact = { id: string; name: string | null; phone: string | null };
type Ticket = { id: string; title: string; status: string; priority: string };

const statuses = [
  { value: "nuevo", label: "Nuevo" },
  { value: "abierto", label: "Abierto" },
  { value: "pendiente", label: "Pendiente" },
  { value: "resuelto", label: "Resuelto" },
  { value: "cerrado", label: "Cerrado" },
];

export function TicketCreateForm({ contacts }: { contacts: Contact[] }) {
  const [state, action, pending] = useActionState(createTicketAction, {});

  if (contacts.length === 0) {
    return <p className="panel-note">Crea un contacto antes de abrir tickets.</p>;
  }

  return (
    <form action={action} className="form-grid">
      <Field label="Contacto" htmlFor="ticket-contact">
        <Select id="ticket-contact" name="contactId" required defaultValue={contacts[0]?.id}>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name ?? contact.phone ?? contact.id}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Título" htmlFor="ticket-title">
        <Input id="ticket-title" name="title" required />
      </Field>
      <Field label="Descripción" htmlFor="ticket-desc">
        <Textarea id="ticket-desc" name="description" rows={3} />
      </Field>
      <div className="form-grid two">
        <Field label="Estado" htmlFor="ticket-status">
          <Select id="ticket-status" name="status" defaultValue="nuevo">
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prioridad" htmlFor="ticket-priority">
          <Select id="ticket-priority" name="priority" defaultValue="normal">
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </Select>
        </Field>
      </div>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      {state.ok ? <p className="msg-ok">{state.message}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creando…" : "Crear ticket"}
      </Button>
    </form>
  );
}

export function TicketStatusForm({ ticket }: { ticket: Ticket }) {
  const [state, action, pending] = useActionState(updateTicketAction.bind(null, ticket.id), {});

  return (
    <form action={action} className="form-grid" style={{ gap: ".4rem" }}>
      <input type="hidden" name="title" value={ticket.title} />
      <Select name="status" defaultValue={ticket.status} aria-label="Estado">
        {statuses.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
      <Select name="priority" defaultValue={ticket.priority} aria-label="Prioridad">
        <option value="low">Baja</option>
        <option value="normal">Normal</option>
        <option value="high">Alta</option>
      </Select>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Actualizar"}
      </Button>
    </form>
  );
}
