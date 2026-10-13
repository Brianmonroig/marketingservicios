"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { loginAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  const confirmed = useSearchParams().get("confirmado") === "1";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <p className="text-sm text-stone-600">Después de la contraseña te pedimos un código nuevo al correo.</p>
      </CardHeader>
      <CardContent>
        {confirmed ? <p className="mb-4 text-sm text-pine">Correo confirmado. Ya puedes entrar.</p> : null}
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Comprobando..." : "Continuar"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-stone-600">
          ¿Primera vez? <Link href="/registro" className="text-pine">Crear agencia</Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
