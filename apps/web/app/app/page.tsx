import { redirect } from "next/navigation";

/** El primer módulo al entrar es el CRM (Chat). */
export default function AppIndexPage() {
  redirect("/app/crm/chat");
}
