"use client";

import { useEffect, useRef } from "react";
import { formatTime, messageStatusLabel } from "@/lib/format";
import type { MessageRow } from "@/lib/api";

export function ThreadFeed({ messages }: { messages: MessageRow[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, messages.at(-1)?.status]);

  if (messages.length === 0) {
    return <div className="thread-feed empty">Todavía no hay mensajes en esta conversación.</div>;
  }

  return (
    <div className="thread-feed" ref={ref}>
      {messages.map((message) => (
        <div key={message.id} className={`bubble ${message.direction === "in" ? "bubble-in" : "bubble-out"}${message.status === "failed" ? " is-failed" : ""}`}>
          {message.type === "template" ? <span className="mono" style={{ display: "block", marginBottom: ".25rem", opacity: 0.8 }}>PLANTILLA</span> : null}
          {message.content}
          <small>
            {formatTime(message.createdAt)}
            {message.direction === "out" ? ` · ${messageStatusLabel[message.status] ?? message.status}` : ""}
            {message.status === "failed" && message.error ? ` · ${message.error}` : ""}
          </small>
        </div>
      ))}
    </div>
  );
}
