"use client";

import { useActionState } from "react";
import { createContactAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function ContactCreateForm() {
  const [state, action, pending] = useActionState(createContactAction, {});

  return (
    <form action={action} className="form-grid">
      <Field label="Nombre" htmlFor="name">
        <Input id="name" name="name" required />
      </Field>
      <div className="form-grid two">
        <Field label="Teléfono" htmlFor="phone">
          <Input id="phone" name="phone" placeholder="+34…" />
        </Field>
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" />
        </Field>
      </div>
      <div className="form-grid two">
        <Field label="Oficio" htmlFor="trade">
          <Input id="trade" name="trade" />
        </Field>
        <Field label="Zona" htmlFor="serviceArea">
          <Input id="serviceArea" name="serviceArea" />
        </Field>
      </div>
      <label className="field" style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
        <input type="checkbox" name="whatsappOptIn" value="true" />
        <span>Permiso de WhatsApp</span>
      </label>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creando…" : "Crear contacto"}
      </Button>
    </form>
  );
}
