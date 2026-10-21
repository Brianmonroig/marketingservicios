import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isManager = session.user.role !== "agent";

  return (
    <div className="app-shell">
      <AppSidebar
        isManager={isManager}
        agencyName={session.user.agencyName}
        userName={session.user.name ?? session.user.email ?? ""}
        role={roleLabel[session.user.role] ?? session.user.role}
      />
      <div className="app-frame">
        <header className="app-topbar">
          <div className="app-topbar-inner">
            <p className="app-topbar-title mono">{session.user.agencyName}</p>
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
        </header>
        <main className="app-main">
          <div className="app-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
