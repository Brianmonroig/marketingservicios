import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { sourceLabel } from "@/lib/format";
import { OpportunityCreateForm, OpportunityEditForm } from "./opportunity-forms";

type Opportunity = {
  id: string;
  name: string | null;
  status: string;
  amount: string | null;
  currency: string;
  source: string | null;
  stageId: string | null;
  stageName: string | null;
  contactId: string;
  contactName: string | null;
  contactPhone: string | null;
};

type Stage = { id: string; name: string; position: number; kind: string };
type Contact = { id: string; name: string | null; phone: string | null };

export default async function OpportunitiesPage() {
  const [oppsResult, stagesResult, contactsResult] = await Promise.all([
    apiFetch<{ opportunities: Opportunity[] }>("/opportunities"),
    apiFetch<{ stages: Stage[] }>("/settings/pipelines"),
    apiFetch<{ contacts: Contact[] }>("/contacts"),
  ]);
  const opportunities = oppsResult.data.opportunities ?? [];
  const stages = stagesResult.data.stages ?? [];
  const contacts = contactsResult.data.contacts ?? [];

  const columnOrder =
    stages.length > 0
      ? stages.map((stage) => stage.name)
      : [...new Set(opportunities.map((item) => item.stageName ?? "Sin etapa"))];

  const grouped = new Map<string, Opportunity[]>();
  for (const name of columnOrder) grouped.set(name, []);
  for (const item of opportunities) {
    const key = item.stageName ?? "Sin etapa";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
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
        Embudo separado de <Link href="/app/crm/contactos">Contactos</Link>. Etapas en{" "}
        <Link href="/app/configuracion/pipelines">Configuración → Pipelines</Link>.
      </p>

      <div className="panel" style={{ marginBottom: "1.2rem", maxWidth: 720 }}>
        <h2>Nueva oportunidad</h2>
        <OpportunityCreateForm contacts={contacts} stages={stages} />
      </div>

      {!oppsResult.ok ? <p className="msg-error">{oppsResult.data.error ?? "No se pudo cargar el pipeline"}</p> : null}

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
                {cards.map((item) => (
                  <li key={item.id} className="board-card" style={{ display: "grid", gap: ".55rem" }}>
                    <Link href={`/app/crm/contactos/${item.contactId}`}>
                      <strong>{item.name ?? item.contactName ?? item.contactPhone ?? "Sin nombre"}</strong>
                    </Link>
                    <span>{sourceLabel[item.source ?? ""] ?? item.source ?? "—"}</span>
                    <span className="mono">
                      {item.amount ? `${item.amount} ${item.currency}` : (item.contactPhone ?? "")}
                    </span>
                    <OpportunityEditForm
                      opportunity={{
                        id: item.id,
                        name: item.name,
                        status: item.status,
                        amount: item.amount,
                        stageId: item.stageId,
                      }}
                      stages={stages}
                    />
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
