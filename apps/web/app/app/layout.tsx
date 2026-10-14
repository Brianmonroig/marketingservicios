import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Brand } from "@/components/brand";
import { AppLinks } from "@/components/app-links";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isManager = session.user.role !== "agent";

  return (
    <>
      <header className="app-nav">
        <div className="container app-nav-inner">
          <Brand href="/app" />
          <AppLinks isManager={isManager} />
          <div className="app-user">
            <div className="who">
              <strong>{session.user.agencyName}</strong>
              <span>
                {session.user.name} · {roleLabel[session.user.role] ?? session.user.role}
              </span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="container">{children}</div>
      </main>
    </>
  );
}
