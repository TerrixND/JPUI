import AuthenticityClientComponent from "@/components/ui/AuthenticityClient";

export default async function AuthenticityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AuthenticityClientComponent authenticityToken={id} />;
}
