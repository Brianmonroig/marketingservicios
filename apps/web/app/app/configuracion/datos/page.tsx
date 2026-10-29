import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function DataPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Datos
          </p>
          <h1 className="page-title">
            Importar y <em>exportar</em>.
          </h1>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 720 }}>
        <p className="panel-note">
          CSV de contactos/oportunidades, auditoría de cambios y borrado seguro llegarán aquí. Mientras tanto los datos
          viven en Postgres con aislamiento por agencia (RLS).
        </p>
        <ul className="timeline">
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>Importación CSV con mapeo de columnas.</span>
          </li>
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>Exportación y registro de auditoría.</span>
          </li>
        </ul>
      </div>
    </>
  );
}
