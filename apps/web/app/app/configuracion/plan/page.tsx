import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";

export default async function PlanPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "agent") {
    return (
      <>
        <h1 className="page-title">
          Sin <em>permiso</em>.
        </h1>
        <p className="panel-note">El plan lo ven dueños y administradores.</p>
      </>
    );
  }

  const result = await apiFetch<{
    plan: string;
    capabilities: string[];
    notIncluded: string[];
  }>("/settings/plan");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Plan
          </p>
          <h1 className="page-title">
            Plan y <em>límites</em>.
          </h1>
        </div>
      </div>
      {!result.ok ? (
        <p className="msg-error">{result.data.error ?? "No se pudo cargar"}</p>
      ) : (
        <div className="split">
          <div className="panel">
            <h2>Plan actual</h2>
            <p>
              <strong>{result.data.plan}</strong>
            </p>
            <p className="panel-note" style={{ marginBottom: 0 }}>
              La facturación se gestiona fuera de la app. Contacta al administrador de North Scale para cambios de plan.
            </p>
          </div>
          <div className="panel">
            <h2>Incluido ahora</h2>
            <ul className="timeline">
              {(result.data.capabilities ?? []).map((item) => (
                <li key={item}>
                  <span className="pill pill-ok">sí</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h2>No incluido (aún)</h2>
            <ul className="timeline">
              {(result.data.notIncluded ?? []).map((item) => (
                <li key={item}>
                  <span className="pill pill-warn">no</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
