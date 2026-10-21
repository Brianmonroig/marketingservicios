import Link from "next/link";

const stages = ["Nuevo", "Abierto", "Pendiente", "Resuelto", "Cerrado"] as const;

export default function TicketsPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            CRM · Tickets
          </p>
          <h1 className="page-title">
            <em>Tickets</em>.
          </h1>
        </div>
      </div>

      <p className="panel-note">
        Modelo tipo HubSpot: los casos salen del <Link href="/app/crm/chat">Chat</Link> y se delegan a colaboradores. La
        persistencia en base de datos se conectará en la siguiente iteración; el tablero y los estados ya están fijados.
      </p>

      <div className="board">
        {stages.map((stage) => (
          <section key={stage} className="board-col">
            <header>
              <h2>{stage}</h2>
              <span className="mono">0</span>
            </header>
            <div className="board-empty">Sin tickets</div>
          </section>
        ))}
      </div>
    </>
  );
}
