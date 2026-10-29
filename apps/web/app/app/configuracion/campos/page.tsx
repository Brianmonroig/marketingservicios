import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function FieldsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Campos
          </p>
          <h1 className="page-title">
            Campos <em>personalizados</em>.
          </h1>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 720 }}>
        <p className="panel-note">
          Aquí podrás definir campos extra para contactos y oportunidades (texto, número, lista…). La estructura de
          datos y la API llegan en una iteración posterior; no hay campos inventados ni datos de demo.
        </p>
        <ul className="timeline">
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>Definición de campos por entidad (contacto / oportunidad).</span>
          </li>
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>Valores visibles en ficha y formularios.</span>
          </li>
        </ul>
      </div>
    </>
  );
}
