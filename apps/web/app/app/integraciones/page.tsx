import { redirect } from "next/navigation";

export default function LegacyIntegrationsRedirect() {
  redirect("/app/configuracion/integraciones");
}
