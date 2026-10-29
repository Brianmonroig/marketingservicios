import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function SecurityPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Seguridad
          </p>
          <h1 className="page-title">
            Acceso y <em>sesiones</em>.
          </h1>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 720 }}>
        <ul className="timeline">
          <li>
            <span className="pill pill-ok">activo</span>
            <span>Inicio de sesión con correo + código de un solo uso (o código genérico de entorno).</span>
          </li>
          <li>
            <span className="pill">activo</span>
            <span>Recuperación de contraseña por correo (si hay proveedor) o mensaje de soporte.</span>
          </li>
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>Revocar sesiones remotas y registro de accesos — pendiente de API dedicada.</span>
          </li>
          <li>
            <span className="pill pill-warn">próximo</span>
            <span>2FA TOTP opcional por usuario — pendiente.</span>
          </li>
        </ul>
        <p className="panel-note" style={{ marginTop: "1rem", marginBottom: 0 }}>
          Cambia tu contraseña desde{" "}
          <a href="/app/configuracion/perfil">Mi perfil</a>.
        </p>
      </div>
    </>
  );
}
