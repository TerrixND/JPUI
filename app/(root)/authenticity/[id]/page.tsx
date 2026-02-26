import AuthenticityClientComponent from "@/components/ui/AuthenticityClient";
import ProductDetailClientComponent from "@/components/ui/ProductDetailClient";
import { SAMPLE_PRODUCT } from "@/utils/data";
import { notFound } from "next/navigation";

// const certificates = [
//   {
//     id: "JP-2024-001",
//     title: "Imperial Dragon Vase",
//     dynasty: "Qing Dynasty",
//     period: "Circa 1736–1795",
//     origin: "Jingdezhen, China",
//     material: "Porcelain with cobalt blue underglaze",
//     provenance: "Private European collection since 1920",
//     certified: "March 12, 2024",
//     expert: "Dr. Lin Wei, Shanghai Museum",
//     seal: "JP-CERT-2024-A",
//     status: "Verified", 
//   },
//   {
//     id: "JP-2024-002",
//     title: "Nephrite Jade Pendant",
//     dynasty: "Han Dynasty",
//     period: "206 BC – 220 AD",
//     origin: "Hetian, Xinjiang",
//     material: "White nephrite jade",
//     provenance: "Sotheby's Hong Kong, 2018",
//     certified: "January 5, 2024",
//     expert: "Prof. Chen Mei, Palace Museum Beijing",
//     seal: "JP-CERT-2024-B",
//     status: "Verified",
//   },
//   {
//     id: "JP-2024-003",
//     title: "Bronze Ritual Vessel (Ding)",
//     dynasty: "Shang Dynasty",
//     period: "Circa 1600–1046 BC",
//     origin: "Henan Province",
//     material: "Bronze alloy",
//     provenance: "Christie's New York, 2015",
//     certified: "May 20, 2024",
//     expert: "Dr. Robert Tsang, Metropolitan Museum",
//     seal: "JP-CERT-2024-C",
//     status: "Verified",
//   },
// ];

export default async function AuthenticityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = SAMPLE_PRODUCT.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  return <AuthenticityClientComponent product={product} />;
}
