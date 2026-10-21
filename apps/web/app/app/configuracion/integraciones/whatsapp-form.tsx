"use client";

import { useActionState } from "react";
import { connectWhatsAppAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function WhatsAppForm() {
  const [state, action, pending] = useActionState(connectWhatsAppAction, {});

  return (
    <form action={action} className="form-grid" style={{ maxWidth: 560 }}>
      <div className="form-grid two">
        <Field label="Id del número" htmlFor="phoneNumberId">
          <Input id="phoneNumberId" name="phoneNumberId" inputMode="numeric" required />
        </Field>
        <Field label="Id de la cuenta de WhatsApp Business" htmlFor="wabaId">
          <Input id="wabaId" name="wabaId" inputMode="numeric" required />
        </Field>
      </div>
      <Field label="Clave de acceso (token)" htmlFor="accessToken">
        <Input id="accessToken" name="accessToken" type="password" autoComplete="off" required />
      </Field>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      {state.ok ? <p className="msg-ok">{state.message}</p> : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Comprobando con Meta…" : "Conectar número"}
        </Button>
      </div>
    </form>
  );
}
