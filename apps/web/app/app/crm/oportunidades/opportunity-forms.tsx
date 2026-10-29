"use client";

import { useActionState } from "react";
import { createOpportunityAction, updateOpportunityAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

type Stage = { id: string; name: string };
type Contact = { id: string; name: string | null; phone: string | null };
type Opportunity = {
  id: string;
  name: string | null;
  status: string;
  amount: string | null;
  stageId: string | null;
};

export function OpportunityCreateForm({ contacts, stages }: { contacts: Contact[]; stages: Stage[] }) {
  const [state, action, pending] = useActionState(createOpportunityAction, {});

  if (contacts.length === 0) {
    return <p className="panel-note">Crea un contacto antes de añadir oportunidades.</p>;
  }

  return (
    <form action={action} className="form-grid">
      <Field label="Contacto" htmlFor="contactId">
        <Select id="contactId" name="contactId" required defaultValue={contacts[0]?.id}>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name ?? contact.phone ?? contact.id}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nombre" htmlFor="opp-name">
        <Input id="opp-name" name="name" required placeholder="Ej.: Instalación split" />
      </Field>
      <div className="form-grid two">
        <Field label="Etapa" htmlFor="stageId">
          <Select id="stageId" name="stageId" defaultValue={stages[0]?.id}>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Importe (EUR)" htmlFor="amount">
          <Input id="amount" name="amount" placeholder="1500.00" />
        </Field>
      </div>
      <input type="hidden" name="currency" value="EUR" />
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      {state.ok ? <p className="msg-ok">{state.message}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creando…" : "Crear oportunidad"}
      </Button>
    </form>
  );
}

export function OpportunityEditForm({ opportunity, stages }: { opportunity: Opportunity; stages: Stage[] }) {
  const [state, action, pending] = useActionState(updateOpportunityAction.bind(null, opportunity.id), {});

  return (
    <form action={action} className="form-grid" style={{ gap: ".45rem" }}>
      <input type="hidden" name="name" value={opportunity.name ?? ""} />
      <Select name="stageId" defaultValue={opportunity.stageId ?? stages[0]?.id} aria-label="Etapa">
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </Select>
      <Input name="amount" defaultValue={opportunity.amount ?? ""} placeholder="Importe" aria-label="Importe" />
      <Select name="status" defaultValue={opportunity.status} aria-label="Estado">
        <option value="open">Abierta</option>
        <option value="won">Ganada</option>
        <option value="lost">Perdida</option>
      </Select>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Guardar"}
      </Button>
    </form>
  );
}
