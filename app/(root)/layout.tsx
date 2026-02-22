import Navbar from "@/components/ui/Navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar heroMode />
      {children}
    </>
  );
}
