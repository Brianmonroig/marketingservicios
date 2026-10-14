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
      <p className="lead">Escribe el código de 6 números que acabamos de enviar. Caduca en 10 minutos.</p>
      <form action={action} className="form">
        <Field label="Código" htmlFor="code">
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        </Field>
        {state.error ? <p className="msg-error">{state.error}</p> : null}
        <Button type="submit" size="block" disabled={pending}>
          {pending ? "Comprobando…" : "Confirmar correo"} <span aria-hidden="true">→</span>
        </Button>
      </form>
    </AuthShell>
  );
}
