"use client";

import { useActionState } from "react";
import { verifyTwoFactorAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TwoFactorPage() {
  const [state, action, pending] = useActionState(verifyTwoFactorAction, {});

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Código de entrada</CardTitle>
          <p className="text-sm text-stone-600">Te lo enviamos al correo para confirmar que eres tú.</p>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
            </div>
            {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
