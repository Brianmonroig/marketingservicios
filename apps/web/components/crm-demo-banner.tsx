"use client";

import { useTransition } from "react";
import { seedDemoCrmAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";

export function CrmDemoBanner({
  isManager,
  compact = false,
}: {
  isManager: boolean;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="panel" style={{ marginBottom: "1.2rem", borderColor: "rgba(31,107,255,.35)" }}>
      <h2 style={{ marginTop: 0 }}>Flujo de ejemplo del CRM</h2>
      {!compact ? (
        <ol className="timeline" style={{ margin: ".6rem 0 1rem" }}>
          <li>
            <span className="pill">1</span>
            <span>
              <strong>Contactos</strong> — fichas con datos, oficio y permiso WhatsApp.
            </span>
          </li>
          <li>
            <span className="pill">2</span>
            <span>
              <strong>Oportunidades</strong> — embudo con importes en distintas etapas.
            </span>
          </li>
          <li>
            <span className="pill">3</span>
            <span>
              <strong>Tickets</strong> — casos Nuevo → Abierto → Pendiente → Resuelto.
            </span>
          </li>
          <li>
            <span className="pill">4</span>
            <span>
              <strong>Chat</strong> — hilo local enlazado al contacto (sin enviar a WhatsApp).
            </span>
          </li>
        </ol>
      ) : (
        <p className="panel-note">
          Rellena Contactos, Oportunidades, Tickets y un Chat local enlazados entre sí. No conecta Meta ni WhatsApp.
        </p>
      )}
      {isManager ? (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!confirm("¿Cargar el ejemplo completo del CRM?")) return;
            start(() => seedDemoCrmAction());
          }}
        >
          {pending ? "Cargando ejemplo…" : "Cargar ejemplo CRM"}
        </Button>
      ) : (
        <p className="panel-note" style={{ marginBottom: 0 }}>
          Pide a un dueño o administrador que pulse «Cargar ejemplo CRM».
        </p>
      )}
    </div>
  );
}
