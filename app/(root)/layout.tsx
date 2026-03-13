import Navbar from "@/components/ui/Navbar";
import WebsiteAiAssistant from "@/components/ui/WebsiteAiAssistant";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar heroMode />
      {children}
      <WebsiteAiAssistant />
    </>
  );
}
