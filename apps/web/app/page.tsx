import Link from "next/link";
import { Brand } from "@/components/brand";
import { LandingEffects } from "@/components/landing-effects";
import { LeadConsole } from "@/components/lead-console";

// Todo lo que afirma esta página corresponde a lo que ya hace el sistema (fases 1 a 3).
// Lo que aún no existe se dice como tal en "Próximas fases" y en las preguntas frecuentes.

const marquee = [
  "Meta Lead Ads",
  "WhatsApp Cloud API",
  "Inbox en tiempo real",
  "Ventana de 24 h",
  "Plantillas aprobadas",
  "Roles por agencia",
  "Código por correo",
  "Tokens cifrados",
  "Embudo en 5 etapas",
];

const services = [
  {
    name: "Leads de Meta Lead Ads",
    tag: "Facebook · Instagram",
    text: "Conectas tu página de Facebook con el inicio de sesión de Meta. Cuando alguien rellena un formulario, el lead se guarda con su teléfono en formato internacional y los identificadores de campaña, conjunto de anuncios, anuncio y formulario. Si Meta avisa dos veces del mismo lead, se guarda uno solo.",
    chips: ["Conexión por OAuth", "Teléfono E.164", "Sin duplicados", "Firma verificada"],
  },
  {
    name: "WhatsApp con la Cloud API oficial",
    tag: "Mensajes · Estados · Plantillas",
    text: "Los mensajes entrantes crean la conversación y el lead. Los envíos salen por una cola con reintentos y cada mensaje muestra si está enviado, entregado o leído. Las plantillas se consultan y se crean desde el propio panel.",
    chips: ["Entrante y saliente", "Sent · Delivered · Read", "Plantillas", "Reintentos"],
  },
  {
    name: "Inbox en tiempo real",
    tag: "Conversación + ficha del lead",
    text: "Los mensajes aparecen sin recargar la página. A la derecha ves la ficha del lead: origen, respuestas del formulario, etapa y permiso de WhatsApp. Si pasan más de 24 h desde su último mensaje, el sistema bloquea el texto libre y te lo dice.",
    chips: ["Sin recargar", "Ficha del lead", "Regla de 24 h"],
  },
  {
    name: "Equipo y seguridad",
    tag: "Roles · Acceso · Datos",
    text: "Cada agencia tiene su espacio y sus datos no se mezclan con los de otra, ni siquiera consultando la base de datos. Dueño, administrador y agente tienen permisos distintos. Para entrar hace falta la contraseña y un código que llega al correo.",
    chips: ["Dueño · Admin · Agente", "Código al correo", "Aislamiento por agencia", "AES-256-GCM"],
  },
  {
    name: "Próximas fases",
    tag: "Aún no disponible",
    text: "Documentos con búsqueda por similitud, agente de IA que responde solo con la información de tu agencia, tablero de leads, paquetes, propuestas en PDF y envío de conversiones a Meta. Están planificadas y no forman parte de lo que hoy puedes usar.",
    chips: ["Documentos y RAG", "Agente de IA", "Tablero", "Conversiones a Meta"],
  },
];

const faqs = [
  {
    q: "¿Necesito alguna aprobación de Meta?",
    a: "Sí. Para recibir leads reales hace falta una app de Meta con los permisos de Lead Ads aprobados en su revisión, y para WhatsApp una cuenta de WhatsApp Business con su número. Lo que falta por validar contra Meta está listado en el archivo docs/PENDIENTES.md del proyecto.",
  },
  {
    q: "¿Se importan las conversaciones anteriores de WhatsApp?",
    a: "No. El historial empieza cuando conectas el número. Importar chats anteriores queda fuera de esta versión.",
  },
  {
    q: "¿Puedo escribir a un lead cuando quiera?",
    a: "Con texto libre, solo si el lead te escribió hace menos de 24 h. Pasado ese tiempo solo se pueden enviar plantillas aprobadas por Meta, y solo a leads que han dado permiso de WhatsApp. El sistema registra ese permiso con fecha y origen.",
  },
  {
    q: "¿Dónde se guardan las claves de Meta?",
    a: "En la base de datos, cifradas con AES-256-GCM. La aplicación no las muestra nunca en pantalla ni las devuelve en sus respuestas.",
  },
  {
    q: "¿Hay agente de IA?",
    a: "Todavía no. Está planificado para una fase posterior. Hoy las conversaciones las atiende el equipo de la agencia.",
  },
  {
    q: "¿Qué puede hacer un agente y qué no?",
    a: "Un agente trabaja los leads y las conversaciones. La gestión del equipo y las conexiones con Meta y WhatsApp están reservadas a dueños y administradores.",
  },
];

export default function HomePage() {
  return (
    <>
      <LandingEffects />
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>

      <header className="nav" data-nav>
        <div className="nav-inner container">
          <Brand href="#top" />
          <nav className="nav-links" id="nav-links" aria-label="Principal">
            <a href="#servicios">Qué incluye</a>
            <a href="#inbox">Inbox</a>
            <a href="#metodo">Cómo empezar</a>
            <a href="#faq">FAQ</a>
            <Link className="btn btn-sm btn-ghost" href="/login">
              Entrar
            </Link>
            <Link className="btn btn-sm btn-primary nav-cta" href="/registro">
              Crear agencia
            </Link>
          </nav>
          <button className="nav-burger" aria-label="Abrir menú" aria-expanded="false" aria-controls="nav-links" data-burger>
            <span />
            <span />
          </button>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <div className="hero-gradient" data-mouse-gradient aria-hidden="true" />
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-grain" aria-hidden="true" />

          <div className="hero-inner container">
            <p className="kicker reveal">
              <span className="pulse" />
              CRM para agencias · Meta Lead Ads · WhatsApp
            </p>

            <h1 className="hero-title">
              <span className="line reveal">Los leads de Meta,</span>
              <span className="line reveal">
                <em>y su</em> conversación.
              </span>
            </h1>

            <div className="hero-bottom">
              <p className="hero-sub reveal">
                Para agencias que venden marketing a negocios de servicios a domicilio. Recibe los leads de tus formularios de <strong>Meta Lead Ads</strong>, escríbeles por <strong>WhatsApp</strong> y sigue cada conversación desde un mismo sitio, con los datos de cada agencia por separado.
              </p>
              <div className="hero-actions reveal">
                <Link className="btn btn-primary" href="/registro">
                  Crear mi agencia <span aria-hidden="true">→</span>
                </Link>
                <a className="btn btn-ghost" href="#metodo">
                  Ver cómo empezar
                </a>
              </div>
            </div>

            <ul className="hero-pillars">
              <li className="reveal">
                <span className="mono">01 / Meta Lead Ads</span>
                <strong>Cada lead, con su origen</strong>
                <p>Se guarda con los identificadores de campaña, anuncio y formulario.</p>
              </li>
              <li className="reveal">
                <span className="mono">02 / WhatsApp</span>
                <strong>Conversación y estados</strong>
                <p>Inbox en tiempo real con la regla de las 24 h a la vista.</p>
              </li>
              <li className="reveal">
                <span className="mono">03 / Tu agencia</span>
                <strong>Espacio propio</strong>
                <p>Dueño, administrador y agente, con acceso por código al correo.</p>
              </li>
            </ul>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[0, 1].map((copy) =>
              marquee.map((item) => (
                <span key={`${copy}-${item}`} style={{ display: "contents" }}>
                  <span>{item}</span>
                  <i>✦</i>
                </span>
              )),
            )}
          </div>
        </div>

        <section className="section manifesto" id="enfoque">
          <div className="container">
            <p className="kicker reveal">Nuestro enfoque</p>
            <p className="manifesto-text reveal">
              Los leads llegan por un lado y las conversaciones viven en otro. <em>Aquí van</em> <span className="hl">juntos</span>, con su historial.
            </p>
            <div className="compare">
              <div className="compare-col compare-old reveal">
                <h3>Repartido</h3>
                <ul>
                  <li>Leads que hay que descargar a mano desde Meta</li>
                  <li>Conversaciones en el móvil de cada persona</li>
                  <li>Sin saber de qué anuncio vino cada contacto</li>
                  <li>Datos de varios clientes en la misma hoja</li>
                </ul>
              </div>
              <div className="compare-col compare-new reveal">
                <h3>En North Scale</h3>
                <ul>
                  <li>Los leads entran solos cuando Meta avisa</li>
                  <li>Una conversación por lead, para todo el equipo</li>
                  <li>Origen del lead guardado en su ficha</li>
                  <li>Cada agencia en su espacio, con permisos por rol</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section services" id="servicios">
          <div className="container">
            <div className="section-head">
              <p className="kicker reveal">Qué incluye</p>
              <h2 className="section-title reveal">
                Lo que ya funciona, <em>explicado</em> sin rodeos.
              </h2>
            </div>
            <ul className="svc-list">
              {services.map((service, index) => (
                <li className="svc reveal" key={service.name}>
                  <button className="svc-head" aria-expanded="false">
                    <span className="svc-num mono">{String(index + 1).padStart(2, "0")}</span>
                    <span className="svc-name">{service.name}</span>
                    <span className="svc-tag">{service.tag}</span>
                    <span className="svc-plus" aria-hidden="true" />
                  </button>
                  <div className="svc-body">
                    <div className="svc-body-inner">
                      <p>{service.text}</p>
                      <ul className="chips">
                        {service.chips.map((chip) => (
                          <li key={chip}>{chip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section ai" id="inbox">
          <div className="ai-glow" aria-hidden="true" />
          <div className="container ai-grid">
            <div className="ai-copy">
              <p className="kicker reveal">Inbox</p>
              <h2 className="section-title reveal">
                Una lista, un origen, <em>una conversación.</em>
              </h2>
              <p className="lead reveal">El equipo ve los mensajes en cuanto llegan y cada lead conserva el recorrido que ha tenido en el sistema.</p>
              <ol className="ai-points">
                <li className="reveal">
                  <span className="mono">A</span>
                  <div>
                    <strong>Entrada de leads</strong>
                    <p>Cuando Meta avisa de un lead nuevo, el sistema lo consulta, lo guarda y lo muestra en la lista.</p>
                  </div>
                </li>
                <li className="reveal">
                  <span className="mono">B</span>
                  <div>
                    <strong>Regla de 24 h a la vista</strong>
                    <p>Si la ventana está cerrada, el cuadro de texto libre se sustituye por el envío de plantillas.</p>
                  </div>
                </li>
                <li className="reveal">
                  <span className="mono">C</span>
                  <div>
                    <strong>Estado de cada mensaje</strong>
                    <p>En cola, enviado, entregado, leído o fallido, con el motivo cuando Meta no lo entrega.</p>
                  </div>
                </li>
                <li className="reveal">
                  <span className="mono">D</span>
                  <div>
                    <strong>Permiso con fecha y origen</strong>
                    <p>Antes de enviar una plantilla se registra de dónde viene el permiso del lead.</p>
                  </div>
                </li>
              </ol>
            </div>
            <LeadConsole />
          </div>
        </section>

        <section className="figures" aria-label="El sistema en cifras">
          <div className="container figures-grid">
            <div className="figure reveal">
              <span className="figure-num" data-count-to="5">5</span>
              <span className="figure-label">etapas del embudo por defecto: de Nuevo a Venta Cerrada</span>
            </div>
            <div className="figure reveal">
              <span className="figure-num" data-count-to="3">3</span>
              <span className="figure-label">roles con permisos distintos: dueño, administrador y agente</span>
            </div>
            <div className="figure reveal">
              <span className="figure-num">
                <span data-count-to="24">24</span> h
              </span>
              <span className="figure-label">de ventana para el texto libre, aplicada por el sistema</span>
            </div>
            <div className="figure reveal">
              <span className="figure-num" data-count-to="2">2</span>
              <span className="figure-label">pasos para entrar: contraseña y código al correo</span>
            </div>
          </div>
        </section>

        <section className="section method" id="metodo">
          <div className="container">
            <div className="section-head">
              <p className="kicker reveal">Cómo empezar</p>
              <h2 className="section-title reveal">
                Cuatro pasos, <em>en este orden.</em>
              </h2>
            </div>
            <ol className="steps">
              <li className="step reveal">
                <span className="step-num mono">01</span>
                <h3>Crea tu agencia</h3>
                <p>Te registras, confirmas el correo con un código y quedas como dueño del espacio. Después añades a tu equipo.</p>
              </li>
              <li className="step reveal">
                <span className="step-num mono">02</span>
                <h3>Conecta la página</h3>
                <p>Inicias sesión con Facebook, eliges la página de los formularios y la activas para recibir sus leads.</p>
              </li>
              <li className="step reveal">
                <span className="step-num mono">03</span>
                <h3>Conecta WhatsApp</h3>
                <p>Indicas el número de la Cloud API y su clave. Meta comprueba que son válidos antes de guardarlos.</p>
              </li>
              <li className="step reveal">
                <span className="step-num mono">04</span>
                <h3>Trabaja el inbox</h3>
                <p>Registra el permiso de cada lead, envía la plantilla de primer contacto y responde cuando escriban.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section fit" id="para-quien">
          <div className="container">
            <div className="section-head">
              <p className="kicker reveal">¿Encaja?</p>
              <h2 className="section-title reveal">
                Hecho para <em>agencias</em> con una forma concreta de trabajar.
              </h2>
            </div>
            <div className="fit-grid">
              <div className="fit-card fit-yes reveal">
                <h3>
                  <span aria-hidden="true">✓</span> Encaja si…
                </h3>
                <ul>
                  <li>Vendes marketing a negocios de servicios a domicilio: fontanería, electricidad, albañilería y similares.</li>
                  <li>Captas con formularios de Meta Lead Ads.</li>
                  <li>Contactas a los leads por WhatsApp.</li>
                  <li>Quieres que cada cliente de la agencia tenga sus datos separados.</li>
                </ul>
              </div>
              <div className="fit-card fit-no reveal">
                <h3>
                  <span aria-hidden="true">✕</span> Todavía no encaja si…
                </h3>
                <ul>
                  <li>Necesitas Instagram o Messenger como canal de mensajes.</li>
                  <li>Quieres importar chats de WhatsApp anteriores a la conexión.</li>
                  <li>Buscas que el sistema cobre las suscripciones de tus clientes.</li>
                  <li>Esperas un agente de IA funcionando hoy.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section faq" id="faq">
          <div className="container faq-grid">
            <div className="section-head">
              <p className="kicker reveal">Preguntas frecuentes</p>
              <h2 className="section-title reveal">
                Lo que conviene <em>saber</em> antes.
              </h2>
              <p className="lead reveal">Respondemos con lo que hace el sistema hoy, sin prometer lo que todavía no existe.</p>
            </div>
            <div className="faq-list">
              {faqs.map((item) => (
                <details className="reveal" key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="section contact" id="contacto">
          <div className="contact-gradient" aria-hidden="true" />
          <div className="container">
            <p className="kicker reveal">Empieza ahora</p>
            <h2 className="contact-title reveal">
              Pon rumbo <em>al norte</em>.
            </h2>
            <p className="lead reveal">Crea el espacio de tu agencia y conecta tu página de Facebook y tu número de WhatsApp.</p>
            <div className="btn-link-row reveal">
              <Link className="btn btn-primary" href="/registro">
                Crear mi agencia <span aria-hidden="true">→</span>
              </Link>
              <Link className="btn btn-ghost" href="/login">
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <Brand href="#top" />
          <nav className="footer-links" aria-label="Pie de página">
            <a href="#servicios">Qué incluye</a>
            <a href="#inbox">Inbox</a>
            <a href="#metodo">Cómo empezar</a>
            <Link href="/login">Entrar</Link>
          </nav>
          <p className="footer-copy mono">© 2026 North Scale · CRM para agencias</p>
        </div>
      </footer>
    </>
  );
}
