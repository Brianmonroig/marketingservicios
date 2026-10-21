"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});

  return (
    <AuthShell>
      <p className="kicker">
        <span className="pulse" />
        Contraseña
      </p>
      <h1>
        ¿Olvidaste tu <em>contraseña</em>?
      </h1>
      <p className="lead">
        Escribe el correo de tu cuenta. Con el envío de correo apagado, en el siguiente paso usa el código{" "}
        <strong className="mono">abc123</strong>.
      </p>
      <form action={action} className="form">
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        {state.error ? <p className="msg-error">{state.error}</p> : null}
        <Button type="submit" size="block" disabled={pending}>
          {pending ? "Continuando…" : "Continuar"} <span aria-hidden="true">→</span>
        </Button>
      </form>
      <p className="auth-foot">
        <Link href="/login">Volver a entrar</Link>
      </p>
    </AuthShell>
  );
}
