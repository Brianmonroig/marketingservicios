import { Brand } from "@/components/brand";

// Fondo de aurora de la referencia, más tenue, detrás de las pantallas de acceso.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="hero-gradient" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-grain" aria-hidden="true" />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <div className="container" style={{ display: "flex", alignItems: "center", height: 72 }}>
          <Brand />
        </div>
      </div>
      <div className="auth-card">{children}</div>
    </div>
  );
}
