import { NextResponse } from "next/server";
import { requiredEnv } from "@/lib/env";

/** Comprueba si la web puede hablar con el API. No muestra secretos. */
export async function GET() {
  let apiUrl: string;
  try {
    apiUrl = requiredEnv("API_URL").replace(/\/$/, "");
  } catch {
    return NextResponse.json({ ok: false, error: "Falta API_URL en crm-web" }, { status: 500 });
  }

  let host: string;
  try {
    host = new URL(apiUrl).host;
  } catch {
    return NextResponse.json({ ok: false, error: "API_URL no es una URL válida", apiUrl }, { status: 500 });
  }

  try {
    const response = await fetch(`${apiUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return NextResponse.json({
      ok: response.ok && body?.ok === true,
      apiHost: host,
      apiStatus: response.status,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      apiHost: host,
      error: error instanceof Error ? error.message : "Sin respuesta del API",
    });
  }
}
