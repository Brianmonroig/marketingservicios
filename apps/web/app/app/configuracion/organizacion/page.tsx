import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";
import { OrganizationForm } from "./organization-form";

type Org = {
  name: string;
  plan: string;
  companyLegalName: string;
  language: string;
  timezone: string;
  currency: string;
  dateFormat: string;
};

export default async function OrganizationPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "agent") {
    return (
      <>
        <h1 className="page-title">
          Sin <em>permiso</em>.
        </h1>
        <p className="panel-note">Solo dueños y administradores editan la organización.</p>
      </>
    );
  }

  const result = await apiFetch<{ organization: Org }>("/settings/organization");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Organización
          </p>
          <h1 className="page-title">
            Datos de la <em>agencia</em>.
          </h1>
        </div>
      </div>
      {!result.ok ? (
        <p className="msg-error">{result.data.error ?? "No se pudo cargar"}</p>
      ) : (
        <div className="panel" style={{ maxWidth: 720 }}>
          <OrganizationForm initial={result.data.organization} />
        </div>
      )}
    </>
  );
}
