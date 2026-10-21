import { redirect } from "next/navigation";

export default function LegacyTeamRedirect() {
  redirect("/app/configuracion/equipo");
}
