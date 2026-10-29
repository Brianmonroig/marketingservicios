"use client";

import { useActionState } from "react";
import { saveOrganizationAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

type Org = {
  name: string;
  companyLegalName: string;
  language: string;
  timezone: string;
  currency: string;
  dateFormat: string;
};

export function OrganizationForm({ initial }: { initial: Org }) {
  const [state, action, pending] = useActionState(saveOrganizationAction, {});

  return (
    <form action={action} className="form-grid">
      <Field label="Nombre de la agencia" htmlFor="name">
        <Input id="name" name="name" defaultValue={initial.name} required minLength={2} />
      </Field>
      <Field label="Razón social (opcional)" htmlFor="companyLegalName">
        <Input id="companyLegalName" name="companyLegalName" defaultValue={initial.companyLegalName} />
      </Field>
      <div className="form-grid two">
        <Field label="Idioma" htmlFor="language">
          <Input id="language" name="language" defaultValue={initial.language} required />
        </Field>
        <Field label="Zona horaria IANA" htmlFor="timezone">
          <Input id="timezone" name="timezone" defaultValue={initial.timezone} required placeholder="Europe/Madrid" />
        </Field>
      </div>
      <div className="form-grid two">
        <Field label="Moneda" htmlFor="currency">
          <Input id="currency" name="currency" defaultValue={initial.currency} required maxLength={3} />
        </Field>
        <Field label="Formato de fecha" htmlFor="dateFormat">
          <Input id="dateFormat" name="dateFormat" defaultValue={initial.dateFormat} required />
        </Field>
      </div>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      {state.ok ? <p className="msg-ok">{state.message ?? "Guardado"}</p> : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
