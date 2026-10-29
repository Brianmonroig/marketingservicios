"use client";

import { useActionState } from "react";
import { createStageAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

type Stage = { id: string; name: string; position: number; kind: string };

const kindLabel: Record<string, string> = {
  open: "Abierta",
  won: "Ganada",
  lost: "Perdida",
  inbox: "Bandeja",
};

export function PipelineForms({ stages, canEdit }: { stages: Stage[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(createStageAction, {});

  return (
    <div className="split">
      <div className="panel">
        <h2>Etapas actuales</h2>
        {stages.length === 0 ? (
          <p className="empty">No hay etapas.</p>
        ) : (
          <ol className="timeline">
            {stages.map((stage) => (
              <li key={stage.id}>
                <span className="pill">{kindLabel[stage.kind] ?? stage.kind}</span>
                <span>
                  {stage.position + 1}. {stage.name}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {canEdit ? (
        <div className="panel">
          <h2>Añadir etapa</h2>
          <form action={action} className="form-grid">
            <Field label="Nombre" htmlFor="name">
              <Input id="name" name="name" required />
            </Field>
            <Field label="Tipo" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue="open">
                <option value="open">Abierta</option>
                <option value="won">Ganada</option>
                <option value="lost">Perdida</option>
                <option value="inbox">Bandeja de entrada</option>
              </Select>
            </Field>
            {state.error ? <p className="msg-error">{state.error}</p> : null}
            {state.ok ? <p className="msg-ok">Etapa creada</p> : null}
            <div>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Creando…" : "Crear etapa"}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="panel">
          <p className="panel-note">Solo dueños y administradores pueden crear etapas.</p>
        </div>
      )}
    </div>
  );
}
