import Link from "next/link";
import { apiFetch, type LeadRow } from "@/lib/api";
import { sourceLabel } from "@/lib/format";

export default async function OpportunitiesPage() {
  const result = await apiFetch<{ leads: LeadRow[] }>("/leads");
  const leads = result.data.leads ?? [];
  const stages =
    leads.length === 0
      ? ["Nuevo", "Contactado", "Cualificado", "Cita Agendada", "Venta Cerrada"]
      : [...new Set(leads.map((lead) => lead.stageName ?? "Sin etapa"))];

  const grouped = new Map<string, LeadRow[]>();
  for (const stage of stages) grouped.set(stage, []);
  for (const lead of leads) {
    const key = lead.stageName ?? "Sin etapa";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(lead);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            CRM · Oportunidades
          </p>
          <h1 className="page-title">
            <em>Pipeline</em>.
          </h1>
        </div>
      </div>

      <p className="panel-note">
        Embudo de oportunidades ligado a <Link href="/app/crm/contactos">Contactos</Link>. Cada tarjeta es un contacto en
        su etapa actual (misma metodología de pipeline).
      </p>

      {!result.ok ? <p className="msg-error">{result.data.error ?? "No se pudo cargar el pipeline"}</p> : null}

      <div className="board">
        {[...grouped.entries()].map(([stage, cards]) => (
          <section key={stage} className="board-col">
            <header>
              <h2>{stage}</h2>
              <span className="mono">{cards.length}</span>
            </header>
            {cards.length === 0 ? (
              <div className="board-empty">Vacío</div>
            ) : (
              <ul className="board-cards">
                {cards.map((lead) => (
                  <li key={lead.id}>
                    <Link href={`/app/crm/contactos/${lead.id}`} className="board-card">
                      <strong>{lead.name ?? lead.phone ?? "Sin nombre"}</strong>
                      <span>{sourceLabel[lead.source ?? ""] ?? lead.source ?? "—"}</span>
                      <span className="mono">{lead.phone ?? lead.email ?? ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
