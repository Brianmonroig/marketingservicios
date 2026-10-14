"use client";

import { useActionState } from "react";
import { verifyTwoFactorAction } from "@/app/actions";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export default function TwoFactorPage() {
  const [state, action, pending] = useActionState(verifyTwoFactorAction, {});

  return (
    <AuthShell>
      <p className="kicker">
        <span className="pulse" />
        Paso 2 de 2
      </p>
      <h1>
        Código de <em>entrada</em>.
      </h1>
      <p className="lead">Te lo enviamos al correo para confirmar que eres tú.</p>
      <form action={action} className="form">
        <Field label="Código" htmlFor="code">
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        </Field>
        {state.error ? <p className="msg-error">{state.error}</p> : null}
        <Button type="submit" size="block" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"} <span aria-hidden="true">→</span>
        </Button>
      </form>
    </AuthShell>
  );
}
