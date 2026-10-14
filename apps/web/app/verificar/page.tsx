"use client";

import { useActionState } from "react";
import { verifyEmailAction } from "@/app/actions";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export default function VerifyPage() {
  const [state, action, pending] = useActionState(verifyEmailAction, {});

  return (
    <AuthShell>
      <p className="kicker">
        <span className="pulse" />
        Paso 1 de 2
      </p>
      <h1>
        Confirma tu <em>correo</em>.
      </h1>
      <p className="lead">
        Por ahora el código de acceso es <strong className="mono">abc123</strong> (también vale con espacio: abc 123). Úsalo para confirmar el correo y para entrar.
      </p>
      <form action={action} className="form">
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Código" htmlFor="code">
          <Input id="code" name="code" autoComplete="one-time-code" required placeholder="abc123" />
        </Field>
        {state.error ? <p className="msg-error">{state.error}</p> : null}
        <Button type="submit" size="block" disabled={pending}>
          {pending ? "Comprobando…" : "Confirmar correo"} <span aria-hidden="true">→</span>
        </Button>
      </form>
    </AuthShell>
  );
}
