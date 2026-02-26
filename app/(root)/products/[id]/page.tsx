// app/(root)/products/[id]/page.tsx

import ProductDetailClientComponent from "@/components/ui/ProductDetailClient";
import { SAMPLE_PRODUCT } from "@/utils/data";
import { notFound } from "next/navigation";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = SAMPLE_PRODUCT.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  return <ProductDetailClientComponent product={product} />;
}
