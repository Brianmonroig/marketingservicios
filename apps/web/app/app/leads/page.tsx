import { redirect } from "next/navigation";

export default async function LegacyLeadsRedirect({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(q ? `/app/crm/contactos?q=${encodeURIComponent(q)}` : "/app/crm/contactos");
}
