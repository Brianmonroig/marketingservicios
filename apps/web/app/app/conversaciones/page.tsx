import { redirect } from "next/navigation";

export default async function LegacyConversationsRedirect({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  redirect(c ? `/app/crm/chat?c=${encodeURIComponent(c)}` : "/app/crm/chat");
}
