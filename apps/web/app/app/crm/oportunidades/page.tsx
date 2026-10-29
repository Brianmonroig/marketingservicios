import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { sourceLabel } from "@/lib/format";

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

export default async function OpportunitiesPage() {
  const [oppsResult, stagesResult] = await Promise.all([
    apiFetch<{ opportunities: Opportunity[] }>("/opportunities"),
    apiFetch<{ stages: Stage[] }>("/settings/pipelines"),
  ]);
  const opportunities = oppsResult.data.opportunities ?? [];
  const stages = stagesResult.data.stages ?? [];

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
        Embudo separado de <Link href="/app/crm/contactos">Contactos</Link>. Las etapas se editan en{" "}
        <Link href="/app/configuracion/pipelines">Configuración → Pipelines</Link>.
      </p>

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
                  <li key={item.id}>
                    <Link href={`/app/crm/contactos/${item.contactId}`} className="board-card">
                      <strong>{item.name ?? item.contactName ?? item.contactPhone ?? "Sin nombre"}</strong>
                      <span>{sourceLabel[item.source ?? ""] ?? item.source ?? "—"}</span>
                      <span className="mono">
                        {item.amount ? `${item.amount} ${item.currency}` : (item.contactPhone ?? "")}
                      </span>
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
