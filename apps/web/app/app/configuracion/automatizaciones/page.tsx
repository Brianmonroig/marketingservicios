import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function AutomationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Automatizaciones
          </p>
          <h1 className="page-title">
            Reglas y <em>bots</em>.
          </h1>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 720 }}>
        <p className="panel-note">
          Aquí vivirán reglas (si / entonces), bots de respuesta y difusiones. Hoy no hay motor de automatización: no
          se muestran flujos simulados ni se envían mensajes sin tu acción explícita.
        </p>
        <ul className="timeline">
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>Reglas al crear contacto / oportunidad / mensaje.</span>
          </li>
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>Bots y difusiones (siempre con confirmación de administrador).</span>
          </li>
        </ul>
      </div>
    </>
  );
}
