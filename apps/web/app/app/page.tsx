import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { apiFetch } from "@/lib/api";

const roleLabel: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  agent: "Agente",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const me = await apiFetch("/auth/me");
  const user = me.ok ? (me.data as { user?: { agencyName: string; name: string; email: string; role: string } }).user : undefined;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-pine">Tu agencia</p>
          <h1 className="mt-2 text-3xl font-semibold">{user?.agencyName ?? session.user.agencyName}</h1>
          <p className="mt-2 text-stone-700">
            {user?.name ?? session.user.name} · {user?.email} · {roleLabel[user?.role ?? session.user.role] ?? session.user.role}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" type="submit">
            Salir
          </button>
        </form>
      </div>
      {session.user.role === "agent" ? (
        <p className="mt-8 max-w-xl text-stone-700">
          Puedes trabajar los leads de esta agencia. La gestión del equipo está reservada a dueños y administradores.
        </p>
      ) : (
        <Link href="/app/equipo" className="mt-8 inline-block rounded-md bg-pine px-4 py-2 text-sm font-medium text-white">
          Personas del equipo
        </Link>
      )}
    </main>
  );
}
