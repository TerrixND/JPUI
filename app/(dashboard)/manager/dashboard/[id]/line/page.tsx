import LineInbox from "@/components/ui/dashboard/LineInbox";

const resolveConversationId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value.trim() : "";

export default async function ManagerLinePage({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string | string[] }>;
}) {
  const params = await searchParams;

  return (
    <LineInbox
      role="manager"
      initialConversationId={resolveConversationId(params.conversationId)}
    />
  );
}
