import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";

export default async function ConfigUsersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Usuarios
          </p>
          <h1 className="page-title">
            Equipo y <em>roles</em>.
          </h1>
        </div>
      </div>
      <div className="panel">
        <p className="panel-note">
          La gestión de usuarios (invitar, roles owner/admin/agent) vive en la sección Equipo del dashboard. Aquí queda
          el acceso directo para no duplicar formularios.
        </p>
        <Link className="btn btn-primary" href="/app/equipo">
          Ir a Equipo
        </Link>
      </div>
    </>
  );
}
