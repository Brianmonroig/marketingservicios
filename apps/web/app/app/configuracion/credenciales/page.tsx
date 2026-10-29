import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";
import { CredentialsForms } from "./credentials-forms";

export default async function CredentialsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "agent") {
    return (
      <>
        <h1 className="page-title">
          Sin <em>permiso</em>.
        </h1>
        <p className="panel-note">Las credenciales son para dueños y administradores.</p>
      </>
    );
  }

  const result = await apiFetch<{
    credentials: Array<{ id: string; provider: string; status: string; metadata: Record<string, unknown>; updatedAt: string }>;
    catalog: Array<{ provider: string; label: string; note?: string; configuredVia: string }>;
  }>("/settings/credentials");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Credenciales
          </p>
          <h1 className="page-title">
            Secretos por <em>conexión</em>.
          </h1>
        </div>
      </div>
      <p className="panel-note">
        Aquí guardas tokens y claves cifradas en el servidor. <strong>No se activan envíos ni campañas</strong> al
        guardar: hace falta una acción explícita de administrador más adelante. Meta y WhatsApp se gestionan también en
        Integraciones.
      </p>
      {!result.ok ? (
        <p className="msg-error">{result.data.error ?? "No se pudo cargar"}</p>
      ) : (
        <CredentialsForms credentials={result.data.credentials ?? []} catalog={result.data.catalog ?? []} />
      )}
    </>
  );
}
