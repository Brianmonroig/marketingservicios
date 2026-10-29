"use client";

import { useActionState } from "react";
import { updateContactAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

type Contact = {
  name: string | null;
  email: string | null;
  phone: string | null;
  trade: string | null;
  serviceArea: string | null;
};

export function ContactEditForm({ contactId, initial }: { contactId: string; initial: Contact }) {
  const [state, action, pending] = useActionState(updateContactAction.bind(null, contactId), {});

  return (
    <form action={action} className="form-grid">
      <Field label="Nombre" htmlFor="edit-name">
        <Input id="edit-name" name="name" defaultValue={initial.name ?? ""} required />
      </Field>
      <div className="form-grid two">
        <Field label="Teléfono" htmlFor="edit-phone">
          <Input id="edit-phone" name="phone" defaultValue={initial.phone ?? ""} />
        </Field>
        <Field label="Correo" htmlFor="edit-email">
          <Input id="edit-email" name="email" type="email" defaultValue={initial.email ?? ""} />
        </Field>
      </div>
      <div className="form-grid two">
        <Field label="Oficio" htmlFor="edit-trade">
          <Input id="edit-trade" name="trade" defaultValue={initial.trade ?? ""} />
        </Field>
        <Field label="Zona" htmlFor="edit-area">
          <Input id="edit-area" name="serviceArea" defaultValue={initial.serviceArea ?? ""} />
        </Field>
      </div>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      {state.ok ? <p className="msg-ok">{state.message}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
