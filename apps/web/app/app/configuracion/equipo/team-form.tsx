"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTeamMemberAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function TeamForm() {
  const [state, action, pending] = useActionState(createTeamMemberAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="form" style={{ marginTop: "1.4rem", maxWidth: 640 }}>
      <h2 style={{ fontSize: "1.25rem" }}>Añadir persona</h2>
      <div className="form-row">
        <Field label="Nombre" htmlFor="name">
          <Input id="name" name="name" required />
        </Field>
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" required />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Contraseña inicial" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Papel" htmlFor="role">
          <Select id="role" name="role" defaultValue="agent">
            <option value="agent">Agente</option>
            <option value="admin">Administrador</option>
          </Select>
        </Field>
      </div>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      {state.ok ? <p className="msg-ok">Persona creada. Tiene que confirmar su correo.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Crear persona"}
      </Button>
    </form>
  );
}
