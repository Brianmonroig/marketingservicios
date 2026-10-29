import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";
import { ProfileForm } from "./profile-form";

type Profile = {
  name: string;
  email: string;
  role: string;
  language: string;
  timezone: string;
  notifyEmail: boolean;
  notifyInbox: boolean;
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await apiFetch<{ profile: Profile }>("/settings/profile");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Perfil
          </p>
          <h1 className="page-title">
            Mi <em>perfil</em>.
          </h1>
        </div>
      </div>
      {!result.ok ? (
        <p className="msg-error">{result.data.error ?? "No se pudo cargar"}</p>
      ) : (
        <div className="panel" style={{ maxWidth: 720 }}>
          <ProfileForm initial={result.data.profile} />
        </div>
      )}
    </>
  );
}
