"use client";

import { useActionState } from "react";
import { saveProfileAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

type Profile = {
  name: string;
  email: string;
  language: string;
  timezone: string;
  notifyEmail: boolean;
  notifyInbox: boolean;
};

export function ProfileForm({ initial }: { initial: Profile }) {
  const [state, action, pending] = useActionState(saveProfileAction, {});

  return (
    <form action={action} className="form-grid">
      <Field label="Nombre" htmlFor="name">
        <Input id="name" name="name" defaultValue={initial.name} required />
      </Field>
      <Field label="Correo" htmlFor="email">
        <Input id="email" value={initial.email} disabled readOnly />
      </Field>
      <div className="form-grid two">
        <Field label="Idioma" htmlFor="language">
          <Input id="language" name="language" defaultValue={initial.language} />
        </Field>
        <Field label="Zona horaria" htmlFor="timezone">
          <Input id="timezone" name="timezone" defaultValue={initial.timezone} />
        </Field>
      </div>
      <label className="field" style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
        <input type="checkbox" name="notifyEmail" defaultChecked={initial.notifyEmail} value="true" />
        <span>Avisos por correo (cuando haya proveedor de correo)</span>
      </label>
      <label className="field" style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
        <input type="checkbox" name="notifyInbox" defaultChecked={initial.notifyInbox} value="true" />
        <span>Avisos en el inbox</span>
      </label>
      <hr style={{ borderColor: "var(--line)" }} />
      <p className="panel-note">Cambiar contraseña (opcional)</p>
      <Field label="Contraseña actual" htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <Field label="Contraseña nueva" htmlFor="newPassword">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} />
      </Field>
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
