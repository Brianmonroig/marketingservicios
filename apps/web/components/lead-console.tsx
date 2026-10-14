"use client";

import { useEffect, useRef, useState } from "react";

type Row = { src: "meta" | "whatsapp"; name: string; status: string };

// Datos ficticios. La consola solo ilustra cómo se ve la entrada de leads.
const demo: Row[] = [
  { src: "meta", name: "Laura M. · Fontanería · Zona norte", status: "Nuevo" },
  { src: "whatsapp", name: "Carlos R. · Electricidad", status: "Ha respondido" },
  { src: "meta", name: "Ana P. · Reforma de baño", status: "Nuevo" },
  { src: "whatsapp", name: "Jorge T. · Albañilería", status: "Plantilla enviada" },
  { src: "meta", name: "Marta S. · Cerrajería urgente", status: "Nuevo" },
  { src: "whatsapp", name: "Pablo V. · Pintura", status: "Ha respondido" },
];

export function LeadConsole() {
  const [rows, setRows] = useState<Array<Row & { key: number }>>(() => demo.slice(0, 4).map((row, index) => ({ ...row, key: index })));
  const feedRef = useRef<HTMLUListElement>(null);
  const counter = useRef(4);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || !("IntersectionObserver" in window)) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let visible = false;
    const push = () => {
      const index = counter.current;
      counter.current += 1;
      const row = demo[index % demo.length] as Row;
      setRows((current) => [{ ...row, key: index }, ...current].slice(0, 4));
    };
    const start = () => {
      if (!timer) timer = setInterval(push, 2600);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false;
        if (visible && !document.hidden) start();
        else stop();
      },
      { threshold: 0.05 },
    );
    observer.observe(feed);
    const onVisibility = () => (document.hidden ? stop() : visible && start());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  return (
    <div className="console reveal" aria-label="Ejemplo ilustrativo de la entrada de leads">
      <div className="console-bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span className="mono">north-scale · leads y conversaciones</span>
        <span className="live">
          <span className="pulse" />
          ejemplo
        </span>
      </div>
      <ul className="console-feed" ref={feedRef}>
        {rows.map((row, index) => (
          <li className={`lead-row${index === 0 && row.key >= 4 ? " is-new" : ""}`} key={row.key}>
            <span className={`src ${row.src === "meta" ? "src-meta" : "src-google"}`}>{row.src === "meta" ? "Meta" : "WhatsApp"}</span>
            <span className="lead-name">{row.name}</span>
            <span className="stage-pill">{row.status}</span>
          </li>
        ))}
      </ul>
      <div className="console-foot">
        <span className="mono">Origen y estado de cada lead</span>
        <span className="mono console-strong">una sola lista</span>
      </div>
      <p className="console-note">Ejemplo ilustrativo con datos ficticios.</p>
    </div>
  );
}
