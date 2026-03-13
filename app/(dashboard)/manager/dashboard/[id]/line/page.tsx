import LineInbox from "@/components/ui/dashboard/LineInbox";

const resolveConversationId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value.trim() : "";
const resolveView = (value: string | string[] | undefined) =>
  typeof value === "string" && value.trim().toLowerCase() === "support"
    ? "support"
    : "conversations";
const resolveSupportRequestId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value.trim() : "";

export default async function ManagerLinePage({
  searchParams,
}: {
  searchParams: Promise<{
    conversationId?: string | string[];
    supportRequestId?: string | string[];
    view?: string | string[];
  }>;
}) {
  const params = await searchParams;

  return (
    <LineInbox
      role="manager"
      initialConversationId={resolveConversationId(params.conversationId)}
      initialSupportRequestId={resolveSupportRequestId(params.supportRequestId)}
      initialView={resolveView(params.view)}
    />
  );
}
