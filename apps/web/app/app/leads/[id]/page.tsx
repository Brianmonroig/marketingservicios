import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { eventLabel, formatDateTime, sourceLabel } from "@/lib/format";
import { OptInForm } from "./opt-in-form";

type LeadDetail = {
  lead: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    source: string | null;
    whatsappOptIn: boolean;
    optInAt: string | null;
    campaignId: string | null;
    adsetId: string | null;
    adId: string | null;
    trade: string | null;
    serviceArea: string | null;
    formAnswers: Record<string, string | string[]>;
    createdAt: string;
    stageName: string | null;
  };
  events: Array<{ id: string; type: string; payload: Record<string, unknown>; occurredAt: string }>;
  conversationId: string | null;
};

function describe(type: string, payload: Record<string, unknown>): string {
  if (type === "opt_in") return `${payload.optIn ? "Permiso concedido" : "Permiso retirado"} · ${String(payload.origin ?? "")}`;
  if (type === "message") return payload.direction === "in" ? "Mensaje recibido" : "Mensaje enviado";
  if (type === "lead_created") return `Origen: ${sourceLabel[String(payload.source)] ?? String(payload.source ?? "")}`;
  return "";
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiFetch<LeadDetail>(`/leads/${id}`);
  if (result.status === 404 || !result.data.lead) notFound();
  const { lead, events, conversationId } = result.data;
  const answers = Object.entries(lead.formAnswers ?? {});

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            {sourceLabel[lead.source ?? ""] ?? lead.source ?? "Lead"} · {lead.stageName ?? "Sin etapa"}
          </p>
          <h1 className="page-title">{lead.name ?? "Sin nombre"}</h1>
        </div>
        {conversationId ? (
          <Link className="btn btn-primary btn-sm" href={`/app/conversaciones?c=${conversationId}`}>
            Abrir conversación <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>

      <div className="two-col">
        <div className="panel">
          <h2>Datos</h2>
          <dl className="lead-card" style={{ padding: 0 }}>
            <div>
              <dt>Teléfono</dt>
              <dd>{lead.phone ?? "Sin teléfono válido"}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{lead.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Oficio</dt>
              <dd>{lead.trade ?? "—"}</dd>
            </div>
            <div>
              <dt>Zona de cobertura</dt>
              <dd>{lead.serviceArea ?? "—"}</dd>
            </div>
            <div>
              <dt>Campaña · conjunto · anuncio</dt>
              <dd>{[lead.campaignId, lead.adsetId, lead.adId].map((value) => value ?? "—").join(" · ")}</dd>
            </div>
            <div>
              <dt>Alta</dt>
              <dd>{formatDateTime(lead.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div>
          <div className="panel">
            <h2>Permiso de WhatsApp</h2>
            <p className="panel-note">
              {lead.whatsappOptIn
                ? `Con permiso desde ${formatDateTime(lead.optInAt)}.`
                : "Sin permiso registrado. Hace falta para enviarle una plantilla."}
            </p>
            <OptInForm leadId={lead.id} current={lead.whatsappOptIn} />
          </div>

          {answers.length > 0 ? (
            <div className="panel">
              <h2>Respuestas del formulario</h2>
              <dl className="lead-card" style={{ padding: 0, marginTop: ".6rem" }}>
                {answers.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{Array.isArray(value) ? value.join(", ") : value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="panel">
            <h2>Historial</h2>
            <ul className="timeline" style={{ marginTop: ".6rem" }}>
              {events.map((event) => (
                <li key={event.id}>
                  <time>{formatDateTime(event.occurredAt)}</time>
                  <span>
                    <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{eventLabel[event.type] ?? event.type}</strong>
                    {describe(event.type, event.payload) ? <span style={{ color: "var(--mute)" }}> · {describe(event.type, event.payload)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
