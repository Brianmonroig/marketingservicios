import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";

export default async function CommunicationPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Comunicación
          </p>
          <h1 className="page-title">
            Bandejas y <em>respuestas</em>.
          </h1>
        </div>
      </div>
      <div className="split">
        <div className="panel">
          <h2>Inbox WhatsApp</h2>
          <p className="panel-note">Conversaciones en tiempo real ya disponibles en CRM.</p>
          <Link className="btn btn-primary" href="/app/crm/chat">
            Ir al Chat
          </Link>
        </div>
        <div className="panel">
          <h2>Plantillas</h2>
          <p className="panel-note">Textos aprobados de WhatsApp y primer contacto.</p>
          <Link className="btn btn-primary" href="/app/configuracion/plantillas">
            Ir a Plantillas
          </Link>
        </div>
        <div className="panel">
          <h2>Firmas y respuestas rápidas</h2>
          <p className="panel-note">Pendiente de persistencia. No hay textos de demo.</p>
          <span className="pill pill-warn">próximo</span>
        </div>
      </div>
    </>
  );
}
