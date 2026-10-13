import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";
import { TeamForm } from "./team-form";

const roleLabel: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  agent: "Agente",
};

export default async function TeamPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const result = await apiFetch("/admin/users");
  if (result.status === 403 || session.user.role === "agent") {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Sin permiso</h1>
        <p className="mt-3 text-stone-700">Esta sección es para dueños y administradores.</p>
      </main>
    );
  }

  const users = (result.data as { users?: Array<{ id: string; name: string; email: string; role: string }> }).users ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Personas del equipo</h1>
      <ul className="mt-6 divide-y divide-line rounded-lg border border-line bg-white">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between px-4 py-3">
            <span>
              {user.name}
              <span className="block text-sm text-stone-600">{user.email}</span>
            </span>
            <span className="text-sm">{roleLabel[user.role] ?? user.role}</span>
          </li>
        ))}
      </ul>
      <TeamForm />
    </main>
  );
}
