"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/app/actions";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  const confirmed = useSearchParams().get("confirmado") === "1";

  return (
    <>
      <p className="kicker">
        <span className="pulse" />
        Acceso
      </p>
      <h1>
        <em>Entrar</em> a tu agencia.
      </h1>
      <p className="lead">Después de la contraseña te pedimos un código nuevo al correo.</p>
      <form action={action} className="form">
        {confirmed ? <p className="msg-ok">Correo confirmado. Ya puedes entrar.</p> : null}
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        {state.error ? <p className="msg-error">{state.error}</p> : null}
        <Button type="submit" size="block" disabled={pending}>
          {pending ? "Comprobando…" : "Continuar"} <span aria-hidden="true">→</span>
        </Button>
      </form>
      <p className="auth-foot">
        ¿Primera vez? <Link href="/registro">Crear agencia</Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
