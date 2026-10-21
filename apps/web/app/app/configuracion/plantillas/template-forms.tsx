"use client";

import { useActionState } from "react";
import { createTemplateAction, setFirstContactAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { TemplateRow } from "@/lib/api";

export function FirstContactForm({
  templates,
  current,
}: {
  templates: TemplateRow[];
  current: { name: string; language: string; params?: string[] } | null;
}) {
  const [state, action, pending] = useActionState(setFirstContactAction, {});

  return (
    <form action={action} className="form-grid">
      <Field label="Plantilla" htmlFor="template">
        <Select id="template" name="template" defaultValue={current ? `${current.name}|${current.language}` : ""}>
          <option value="">Desactivado</option>
          {templates.map((template) => (
            <option key={`${template.name}|${template.language}`} value={`${template.name}|${template.language}`}>
              {template.name} ({template.language})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Valores de las variables (uno por línea)" htmlFor="params">
        <Textarea id="params" name="params" rows={2} defaultValue={current?.params?.join("\n") ?? ""} />
      </Field>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      {state.ok ? <p className="msg-ok">{state.message}</p> : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

export function CreateTemplateForm() {
  const [state, action, pending] = useActionState(createTemplateAction, {});

  return (
    <form action={action} className="form-grid">
      <div className="form-grid two">
        <Field label="Nombre" htmlFor="tpl-name">
          <Input id="tpl-name" name="name" placeholder="primer_contacto" pattern="[a-z0-9_]+" required />
        </Field>
        <Field label="Idioma" htmlFor="tpl-language">
          <Input id="tpl-language" name="language" defaultValue="es" required />
        </Field>
      </div>
      <Field label="Categoría" htmlFor="tpl-category">
        <Select id="tpl-category" name="category" defaultValue="UTILITY">
          <option value="UTILITY">Utilidad</option>
          <option value="MARKETING">Marketing</option>
          <option value="AUTHENTICATION">Autenticación</option>
        </Select>
      </Field>
      <Field label="Texto" htmlFor="tpl-body">
        <Textarea id="tpl-body" name="bodyText" rows={3} required />
      </Field>
      <Field label="Ejemplos de las variables (uno por línea)" htmlFor="tpl-examples">
        <Textarea id="tpl-examples" name="bodyExamples" rows={2} />
      </Field>
      {state.error ? <p className="msg-error">{state.error}</p> : null}
      {state.ok ? <p className="msg-ok">{state.message}</p> : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enviando…" : "Crear plantilla"}
        </Button>
      </div>
    </form>
  );
}
