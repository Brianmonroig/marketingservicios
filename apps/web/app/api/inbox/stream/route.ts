import { auth } from "@/auth";
import { requiredEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// El navegador no puede mandar la cabecera Authorization en un EventSource.
// Este puente abre la conexión con el API desde el servidor y reenvía los eventos.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) return new Response("No autorizado", { status: 401 });

  const upstream = await fetch(`${requiredEnv("API_URL")}/inbox/stream`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
    signal: request.signal,
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) return new Response("Sin conexión con el API", { status: 502 });

  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
