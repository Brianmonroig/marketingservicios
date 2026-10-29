"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const sections = [
  { href: "/app/configuracion/organizacion", title: "Organización", note: "Nombre, idioma, zona horaria, moneda y horario.", tags: "empresa timezone moneda" },
  { href: "/app/configuracion/perfil", title: "Mi perfil", note: "Nombre, preferencias y cambio de contraseña.", tags: "usuario password" },
  { href: "/app/configuracion/equipo", title: "Equipo", note: "Usuarios owner, admin y agente.", tags: "roles usuarios" },
  { href: "/app/configuracion/pipelines", title: "Pipelines", note: "Etapas del embudo de oportunidades.", tags: "etapas kanban" },
  { href: "/app/configuracion/campos", title: "Campos", note: "Campos personalizados (estructura preparada).", tags: "custom fields" },
  { href: "/app/configuracion/comunicacion", title: "Comunicación", note: "Bandejas, firmas y respuestas rápidas (próxima iteración).", tags: "inbox firmas" },
  { href: "/app/configuracion/automatizaciones", title: "Automatizaciones", note: "Reglas y bots (aún no implementado).", tags: "bots reglas" },
  { href: "/app/configuracion/integraciones", title: "Integraciones", note: "Meta Lead Ads y WhatsApp Cloud API.", tags: "meta whatsapp" },
  { href: "/app/configuracion/credenciales", title: "Credenciales", note: "Telegram, correo y Google: guardar secretos cifrados sin activar envíos.", tags: "telegram email google token" },
  { href: "/app/configuracion/plantillas", title: "Plantillas", note: "Plantillas WhatsApp y primer contacto.", tags: "whatsapp templates" },
  { href: "/app/configuracion/datos", title: "Datos", note: "Importación, exportación y auditoría (próxima iteración).", tags: "import export" },
  { href: "/app/configuracion/metricas", title: "Métricas", note: "Informes y atribución (próxima iteración).", tags: "reportes" },
  { href: "/app/configuracion/plan", title: "Plan", note: "Capacidades reales del producto. Sin facturación inventada.", tags: "consumo plan" },
];

export default function ConfigHomePage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sections;
    return sections.filter((item) => `${item.title} ${item.note} ${item.tags}`.toLowerCase().includes(needle));
  }, [q]);

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
        <label className="field" style={{ minWidth: 260 }}>
          <span>Buscar sección</span>
          <input className="input" value={q} onChange={(event) => setQ(event.target.value)} placeholder="pipelines, telegram, equipo…" />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="panel empty">Ninguna sección coincide con «{q}».</div>
      ) : (
        <div className="stat-grid">
          {filtered.map((card) => (
            <Link key={card.href} href={card.href} className="stat stat-link">
              <span className="mono">{card.title}</span>
              <p className="panel-note" style={{ margin: ".6rem 0 0" }}>
                {card.note}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
