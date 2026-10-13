"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, {});

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Crear agencia</CardTitle>
          <p className="text-sm text-stone-600">La primera persona queda como dueña del espacio.</p>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <Field label="Nombre de la agencia" name="agencyName" />
            <Field label="Tu nombre" name="name" />
            <Field label="Correo" name="email" type="email" />
            <Field label="Contraseña" name="password" type="password" />
            {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Creando..." : "Crear y enviar código"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-stone-600">
            ¿Ya tienes cuenta? <Link href="/login" className="text-pine">Entrar</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ label, name, type = "text" }: { label: string; name: string; type?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required />
    </div>
  );
}
