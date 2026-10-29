"use client";

import { useActionState } from "react";
import { saveCredentialAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

type Cred = { id: string; provider: string; status: string; metadata: Record<string, unknown>; updatedAt: string };
type Catalog = { provider: string; label: string; note?: string; configuredVia: string };

export function CredentialsForms({ credentials, catalog }: { credentials: Cred[]; catalog: Catalog[] }) {
  const [telegramState, telegramAction, telegramPending] = useActionState(saveCredentialAction.bind(null, "telegram"), {});
  const [emailState, emailAction, emailPending] = useActionState(saveCredentialAction.bind(null, "email"), {});
  const [googleState, googleAction, googlePending] = useActionState(saveCredentialAction.bind(null, "google"), {});

  return (
    <div className="form-grid" style={{ gap: "1.2rem" }}>
      <div className="panel">
        <h2>Estado guardado</h2>
        {credentials.length === 0 ? (
          <p className="empty">Todavía no hay credenciales guardadas.</p>
        ) : (
          <ul className="timeline">
            {credentials.map((item) => (
              <li key={item.id}>
                <span className={`pill ${item.status === "active" ? "pill-ok" : "pill-warn"}`}>{item.status}</span>
                <span>
                  {item.provider} · actualizado {new Date(item.updatedAt).toLocaleString("es-ES")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="panel-note" style={{ marginTop: "1rem", marginBottom: 0 }}>
          Catálogo: {catalog.map((item) => item.label).join(" · ")}
        </p>
      </div>

      <div className="split">
        <div className="panel">
          <h2>Telegram</h2>
          <p className="panel-note">Guarda el token del bot. No envía mensajes al guardar.</p>
          <form action={telegramAction} className="form-grid">
            <Field label="Bot token" htmlFor="botToken">
              <Input id="botToken" name="botToken" type="password" autoComplete="off" required />
            </Field>
            <Field label="Notas de política / opt-in" htmlFor="policyNotes">
              <Textarea id="policyNotes" name="policyNotes" rows={3} />
            </Field>
            {telegramState.error ? <p className="msg-error">{telegramState.error}</p> : null}
            {telegramState.ok ? <p className="msg-ok">Token guardado (cifrado). Envío no activado.</p> : null}
            <Button type="submit" size="sm" disabled={telegramPending}>
              {telegramPending ? "Guardando…" : "Guardar Telegram"}
            </Button>
          </form>
        </div>

        <div className="panel">
          <h2>Correo (API)</h2>
          <p className="panel-note">Clave de API y remitente. No envía correos al guardar.</p>
          <form action={emailAction} className="form-grid">
            <Field label="Proveedor" htmlFor="mailProvider">
              <Select id="mailProvider" name="mailProvider" defaultValue="resend">
                <option value="resend">Resend</option>
                <option value="brevo">Brevo</option>
                <option value="other">Otro</option>
              </Select>
            </Field>
            <Field label="Remitente" htmlFor="fromAddress">
              <Input id="fromAddress" name="fromAddress" placeholder="Nombre <hola@tudominio.com>" required />
            </Field>
            <Field label="API key" htmlFor="apiKey">
              <Input id="apiKey" name="apiKey" type="password" autoComplete="off" required />
            </Field>
            {emailState.error ? <p className="msg-error">{emailState.error}</p> : null}
            {emailState.ok ? <p className="msg-ok">Credencial de correo guardada (cifrada). Envío no activado.</p> : null}
            <Button type="submit" size="sm" disabled={emailPending}>
              {emailPending ? "Guardando…" : "Guardar correo"}
            </Button>
          </form>
        </div>
      </div>

      <div className="panel">
        <h2>Google (OAuth client)</h2>
        <p className="panel-note">
          Client ID y Client Secret para futuros flujos (Gmail, Calendar, Sheets…). No inicia OAuth ni sincroniza al
          guardar.
        </p>
        <form action={googleAction} className="form-grid" style={{ maxWidth: 640 }}>
          <Field label="Client ID" htmlFor="clientId">
            <Input id="clientId" name="clientId" required />
          </Field>
          <Field label="Client Secret" htmlFor="clientSecret">
            <Input id="clientSecret" name="clientSecret" type="password" autoComplete="off" required />
          </Field>
          {googleState.error ? <p className="msg-error">{googleState.error}</p> : null}
          {googleState.ok ? <p className="msg-ok">Credenciales Google guardadas (secret cifrado). OAuth no activado.</p> : null}
          <Button type="submit" size="sm" disabled={googlePending}>
            {googlePending ? "Guardando…" : "Guardar Google"}
          </Button>
        </form>
      </div>
    </div>
  );
}
