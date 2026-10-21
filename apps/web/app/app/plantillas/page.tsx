import { redirect } from "next/navigation";

export default function LegacyTemplatesRedirect() {
  redirect("/app/configuracion/plantillas");
}