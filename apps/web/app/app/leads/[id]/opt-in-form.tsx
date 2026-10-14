"use client";

import { useActionState } from "react";
import { setOptInAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function OptInForm({ leadId, current }: { leadId: string; current: boolean }) {
  const [state, action, pending] = useActionState(setOptInAction.bind(null, leadId), {});

  return (
    <form action={action} className="form-grid">
      <Field label="¿De dónde viene el permiso?" htmlFor="origin">
        <Input id="origin" name="origin" placeholder="Ej.: casilla del formulario, lo pidió por teléfono" required minLength={2} />
      </Field>
      <input type="hidden" name="optIn" value={current ? "false" : "true"} />
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      {state.ok ? <p className="msg-ok">{state.message}</p> : null}
      <div>
        <Button type="submit" variant={current ? "danger" : "default"} size="sm" disabled={pending}>
          {pending ? "Guardando…" : current ? "Retirar permiso" : "Registrar permiso"}
        </Button>
      </div>
    </form>
  );
}
