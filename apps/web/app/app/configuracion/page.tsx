import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Link from "next/link";

export default async function ConfigHomePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "agent") {
    return (
      <>
        <h1 className="page-title">
          Sin <em>permiso</em>.
        </h1>
        <p className="panel-note">La configuración es para dueños y administradores.</p>
      </>
    );
  }

  const cards = [
    { href: "/app/configuracion/integraciones", title: "Integraciones", note: "Meta Lead Ads y WhatsApp Cloud API." },
    { href: "/app/configuracion/canales", title: "Canales", note: "Políticas de Telegram y correo genérico (configuración)." },
    { href: "/app/configuracion/plantillas", title: "Plantillas", note: "Plantillas de WhatsApp y primer contacto." },
    { href: "/app/configuracion/equipo", title: "Equipo", note: "Usuarios con roles administrador y operador." },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración
          </p>
          <h1 className="page-title">
            Ajustes de la <em>agencia</em>.
          </h1>
        </div>
      </div>
      <div className="stat-grid">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="stat stat-link">
            <span className="mono">{card.title}</span>
            <p className="panel-note" style={{ margin: ".6rem 0 0" }}>
              {card.note}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
