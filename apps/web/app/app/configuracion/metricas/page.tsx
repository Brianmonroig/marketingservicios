import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function MetricsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Métricas
          </p>
          <h1 className="page-title">
            Informes y <em>atribución</em>.
          </h1>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 720 }}>
        <p className="panel-note">
          Reportes de embudo, tiempos de respuesta y atribución de anuncios (Meta/Google) se construirán sobre datos
          reales. No hay gráficos inventados en esta pantalla.
        </p>
        <ul className="timeline">
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>Embudo por etapa y conversión.</span>
          </li>
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>Atribución campaña → contacto → oportunidad.</span>
          </li>
        </ul>
      </div>
    </>
  );
}
