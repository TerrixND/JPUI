"use client";

import ProductDetailClientComponent from "@/components/ui/ProductDetailClient";
import {
  ApiClientError,
  getPublicProductDetail,
  type PublicProductRecord,
} from "@/lib/apiClient";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ComponentProps } from "react";

type ProductDetailModel = ComponentProps<typeof ProductDetailClientComponent>["product"];

const toProductDetailModel = (product: PublicProductRecord): ProductDetailModel => {
  const media = (Array.isArray(product.media) ? product.media : [])
    .filter((entry) => Boolean(entry.url))
    .map((entry, index) => ({
      id: entry.id,
      type: entry.type || "IMAGE",
      url: entry.url,
      isPrimary: index === 0,
    }));

  const certificateMedia = media.find((entry) => {
    const normalizedType = String(entry.type || "").toUpperCase();
    return normalizedType === "PDF" || normalizedType === "CERTIFICATE";
  });

  return {
    id: product.id,
    name: product.name || product.sku || "Jade Product",
    sku: product.sku,
    color: product.color,
    origin: product.origin,
    description: product.description,
    weight: product.weight,
    length: product.length,
    depth: product.depth,
    height: product.height,
    totalMassGram: product.totalMassGram,
    refractiveIndex: product.refractiveIndex,
    densityGPerCm3: product.densityGPerCm3,
    uvVisSpectrumNm: product.uvVisSpectrumNm,
    cutAndShape: product.cutAndShape,
    measurementMm: product.measurementMm,
    tier: product.tier,
    status: product.status || "AVAILABLE",
    sourceType: product.origin,
    media,
    currentOwnership: null,
    certificate: certificateMedia
      ? {
          fileUrl: certificateMedia.url,
        }
      : null,
  };
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = typeof params?.id === "string" ? params.id.trim() : "";
  const [product, setProduct] = useState<ProductDetailModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;

    const loadProduct = async () => {
      if (!productId) {
        setErrorMessage("Product ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getPublicProductDetail({
          productId,
        });

        if (isDisposed) {
          return;
        }

        setProduct(toProductDetailModel(response));
      } catch (error) {
        if (isDisposed) {
          return;
        }

        setProduct(null);
        if (error instanceof ApiClientError && error.status === 404) {
          setErrorMessage("Product not found.");
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load product details.");
        }
      } finally {
        if (!isDisposed) {
          setIsLoading(false);
        }
      }
    };

    void loadProduct();

    return () => {
      isDisposed = true;
    };
  }, [productId]);

  if (isLoading) {
    return (
      <div className="w-full bg-white py-24 px-6 sm:px-12 lg:px-20 text-stone-500">
        Loading product details...
      </div>
    );
  }

  if (!product || errorMessage) {
    return (
      <div className="w-full bg-white py-24 px-6 sm:px-12 lg:px-20">
        <div className="max-w-2xl rounded-2xl border border-stone-200 bg-stone-50 p-8">
          <h1 className="text-2xl font-light text-stone-900">Unable to open this product</h1>
          <p className="mt-3 text-sm text-stone-600">{errorMessage || "Product not found."}</p>
          <Link
            href="/products"
            className="mt-6 inline-flex rounded-full border border-stone-300 px-5 py-2 text-sm text-stone-700 hover:bg-stone-100 transition-colors"
          >
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  return <ProductDetailClientComponent product={product} />;
}
