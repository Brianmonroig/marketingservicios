import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";
import { PipelineForms } from "./pipeline-forms";

type Stage = { id: string; name: string; position: number; kind: string };

export default async function PipelinesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const isManager = session.user.role !== "agent";
  const result = await apiFetch<{ stages: Stage[] }>("/settings/pipelines");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Pipelines
          </p>
          <h1 className="page-title">
            Etapas del <em>embudo</em>.
          </h1>
        </div>
      </div>
      <p className="panel-note">Estas etapas alimentan Contactos/Oportunidades. No se borran datos al renombrar.</p>
      {!result.ok ? (
        <p className="msg-error">{result.data.error ?? "No se pudieron cargar las etapas"}</p>
      ) : (
        <PipelineForms stages={result.data.stages ?? []} canEdit={isManager} />
      )}
    </>
  );
}
