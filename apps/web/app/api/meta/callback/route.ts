import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { apiFetch } from "@/lib/api";
import { requiredEnv } from "@/lib/env";

// Facebook devuelve aquí al usuario con un código. Se cambia por las páginas a través del API.
export async function GET(request: NextRequest) {
  const base = requiredEnv("AUTH_URL").replace(/\/$/, "");
  const back = (query: string) => NextResponse.redirect(`${base}/app/configuracion/integraciones?${query}`);

  const session = await auth();
  if (!session) return NextResponse.redirect(`${base}/login`);

  const params = request.nextUrl.searchParams;
  if (params.get("error")) {
    return back(`error=${encodeURIComponent("Cancelaste el permiso de Facebook o Meta lo rechazó.")}`);
  }
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return back(`error=${encodeURIComponent("Facebook no devolvió el código de autorización.")}`);

  const result = await apiFetch<{ pagesFound?: number }>("/integrations/meta/oauth-exchange", {
    method: "POST",
    body: JSON.stringify({ code, state, redirectUri: `${base}/api/meta/callback` }),
  });
  if (!result.ok) return back(`error=${encodeURIComponent(result.data.error ?? "No se pudieron leer las páginas de Facebook")}`);
  return back(`ok=paginas&n=${result.data.pagesFound ?? 0}`);
}
