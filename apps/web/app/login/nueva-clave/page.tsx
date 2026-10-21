"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPasswordAction } from "@/app/actions";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

function ResetForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  const email = useSearchParams().get("email") ?? "";

  return (
    <>
      <p className="kicker">
        <span className="pulse" />
        Nueva contraseña
      </p>
      <h1>
        Elige una <em>clave nueva</em>.
      </h1>
      <p className="lead">
        Código de prueba: <strong className="mono">abc123</strong>. La contraseña nueva necesita al menos 8 caracteres.
      </p>
      <form action={action} className="form">
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} />
        </Field>
        <Field label="Código" htmlFor="code">
          <Input id="code" name="code" autoComplete="one-time-code" required placeholder="abc123" />
        </Field>
        <Field label="Contraseña nueva" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        {state.error ? <p className="msg-error">{state.error}</p> : null}
        <Button type="submit" size="block" disabled={pending}>
          {pending ? "Guardando…" : "Guardar contraseña"} <span aria-hidden="true">→</span>
        </Button>
      </form>
      <p className="auth-foot">
        <Link href="/login/olvidar">Pedir de nuevo</Link>
        {" · "}
        <Link href="/login">Entrar</Link>
      </p>
    </>
  );
}

export default function NewPasswordPage() {
  return (
    <AuthShell>
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
