"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/app/actions";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, {});

  return (
    <AuthShell>
      <p className="kicker">
        <span className="pulse" />
        Nueva agencia
      </p>
      <h1>
        Crea tu <em>agencia</em>.
      </h1>
      <p className="lead">
        La primera persona queda como dueña. El correo de códigos está apagado: en el siguiente paso usa{" "}
        <strong className="mono">abc123</strong>.
      </p>
      <form action={action} className="form">
        <Field label="Nombre de la agencia" htmlFor="agencyName">
          <Input id="agencyName" name="agencyName" required />
        </Field>
        <Field label="Tu nombre" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        {state.error ? <p className="msg-error">{state.error}</p> : null}
        <Button type="submit" size="block" disabled={pending}>
          {pending ? "Creando…" : "Crear agencia"} <span aria-hidden="true">→</span>
        </Button>
      </form>
      <p className="auth-foot">
        ¿Ya tienes cuenta? <Link href="/login">Entrar</Link>
      </p>
    </AuthShell>
  );
}
