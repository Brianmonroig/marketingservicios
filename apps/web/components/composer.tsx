"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendTemplateAction, sendTextAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { TemplateRow } from "@/lib/api";

export function TextComposer({ conversationId }: { conversationId: string }) {
  const [state, action, pending] = useActionState(sendTextAction.bind(null, conversationId), {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form action={action} ref={formRef} className="composer">
      <div className="composer-row">
        <Textarea name="text" placeholder="Escribe un mensaje…" required rows={2} style={{ flex: 1 }} aria-label="Mensaje" />
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
    </form>
  );
}

function variableCount(text: string): number {
  return new Set(text.match(/\{\{\d+\}\}/g) ?? []).size;
}

export function TemplateComposer({
  conversationId,
  templates,
  canSend,
  windowOpen,
}: {
  conversationId: string;
  templates: TemplateRow[];
  canSend: boolean;
  windowOpen: boolean;
}) {
  const approved = templates.filter((template) => template.status === "APPROVED");
  const [state, action, pending] = useActionState(sendTemplateAction.bind(null, conversationId), {});
  const [selected, setSelected] = useState(approved[0] ? `${approved[0].name}|${approved[0].language}` : "");
  const current = approved.find((template) => `${template.name}|${template.language}` === selected);
  const variables = current ? variableCount(current.bodyText) : 0;

  return (
    <form action={action} className="composer">
      {!windowOpen ? (
        <div className="notice">
          La ventana de 24 h está cerrada: el lead no ha escrito en las últimas 24 horas. Solo puedes enviarle una plantilla aprobada.
        </div>
      ) : null}
      {!canSend ? (
        <div className="notice">Este lead no ha dado permiso de WhatsApp. Regístralo en su ficha para poder enviarle una plantilla.</div>
      ) : null}
      {approved.length === 0 ? (
        <p className="panel-note" style={{ margin: 0 }}>
          No hay plantillas aprobadas. Crea una en la sección Plantillas y espera la aprobación de Meta.
        </p>
      ) : (
        <>
          <div className="form-grid two">
            <Field label="Plantilla" htmlFor="template-choice">
              <Select
                id="template-choice"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                {approved.map((template) => (
                  <option key={`${template.name}|${template.language}`} value={`${template.name}|${template.language}`}>
                    {template.name} ({template.language})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <input type="hidden" name="name" value={current?.name ?? ""} />
          <input type="hidden" name="language" value={current?.language ?? ""} />
          {current ? <p className="panel-note" style={{ margin: 0 }}>{current.bodyText}</p> : null}
          {Array.from({ length: variables }, (_unused, index) => (
            <Field key={`${selected}-${index}`} label={`Variable {{${index + 1}}}`} htmlFor={`param-${index}`}>
              <Input id={`param-${index}`} name="param" required />
            </Field>
          ))}
          {state.error ? <p className="msg-error">{state.error}</p> : null}
          <div>
            <Button type="submit" size="sm" disabled={pending || !canSend || !current}>
              {pending ? "Enviando…" : "Enviar plantilla"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
