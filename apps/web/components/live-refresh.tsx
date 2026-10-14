"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Abre la conexión de eventos del inbox y vuelve a pedir los datos de la página
// cuando llega un mensaje o cambia un estado. No recarga la página.
export function LiveRefresh() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/inbox/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    return () => {
      source.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);

  return (
    <span className={`pill ${connected ? "pill-ok" : "pill-mute"}`} title={connected ? "Recibiendo mensajes en tiempo real" : "Reconectando…"}>
      <span className="pulse" style={{ width: 6, height: 6, background: connected ? undefined : "var(--mute)", animation: connected ? undefined : "none" }} />
      {connected ? "En vivo" : "Reconectando"}
    </span>
  );
}
