import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";
import { roleLabel } from "@/lib/format";
import { TeamForm } from "./team-form";

export default async function TeamPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const result = await apiFetch<{ users?: Array<{ id: string; name: string; email: string; role: string }> }>("/admin/users");
  if (result.status === 403 || session.user.role === "agent") {
    return (
      <>
        <h1 className="page-title">
          Sin <em>permiso</em>.
        </h1>
        <p className="panel-note">Esta sección es para dueños y administradores.</p>
      </>
    );
  }

  const users = result.data.users ?? [];

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          Personas del <em>equipo</em>.
        </h1>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Papel</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={{ color: "var(--ink)" }}>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className="pill">{roleLabel[user.role] ?? user.role}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TeamForm />
    </>
  );
}
