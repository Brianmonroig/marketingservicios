"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTeamMemberAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TeamForm() {
  const [state, action, pending] = useActionState(createTeamMemberAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="mt-8 grid gap-4 rounded-lg border border-line bg-white p-6">
      <h2 className="text-lg font-semibold">Añadir persona</h2>
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña inicial</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Papel</Label>
        <select id="role" name="role" className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm">
          <option value="agent">Agente</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-pine">Persona creada. Tiene que confirmar su correo.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Crear persona"}
      </Button>
      <Link href="/app" className="text-sm text-pine">
        Volver
      </Link>
    </form>
  );
}
