"use client";

import { useTransition } from "react";
import { seedDemoCrmAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";

export function DemoSeedButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm("¿Cargar el ejemplo completo del CRM (contactos, oportunidades, tickets y chat local)?")) return;
        start(() => seedDemoCrmAction());
      }}
    >
      {pending ? "Cargando…" : "Cargar ejemplo CRM"}
    </Button>
  );
}
