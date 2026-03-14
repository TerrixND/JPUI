"use client";

import Link from "next/link";
import { isSafeAssistantProductRoute } from "@/lib/assistant/assistantActionExecutor";
import type { WebsiteAssistantProductResultItem } from "@/lib/websiteAssistantApi";

const IMAGE_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">
    <rect width="320" height="240" fill="#f5f5f4"/>
    <circle cx="160" cy="104" r="38" fill="#d6d3d1"/>
    <rect x="78" y="176" width="164" height="14" rx="7" fill="#d6d3d1"/>
  </svg>`);

const formatWeightLabel = (item: WebsiteAssistantProductResultItem) => {
  if (item.weightCarat) {
    return `${item.weightCarat} ct`;
  }

  if (item.weightGram) {
    return `${item.weightGram} g`;
  }

  return null;
};

const ProductResultCard = ({
  item,
}: {
  item: WebsiteAssistantProductResultItem;
}) => {
  const weightLabel = formatWeightLabel(item);
  const productRoute = isSafeAssistantProductRoute(item.productRoute);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50/80">
      <div className="relative aspect-[4/3] overflow-hidden bg-white">
        <img
          alt={item.name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = IMAGE_PLACEHOLDER;
          }}
          src={item.mediaPreviewUrl || IMAGE_PLACEHOLDER}
        />
      </div>

      <div className="space-y-3 p-3.5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-5 text-stone-900">
            {item.name}
          </h3>
          {item.shortDescription ? (
            <p className="text-xs leading-5 text-stone-600">
              {item.shortDescription}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {item.productType ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 shadow-sm">
              {item.productType}
            </span>
          ) : null}
          {item.color ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 shadow-sm">
              {item.color}
            </span>
          ) : null}
          {item.shape ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 shadow-sm">
              {item.shape}
            </span>
          ) : null}
          {weightLabel ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 shadow-sm">
              {weightLabel}
            </span>
          ) : null}
          {item.hasCertificate ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              Certificate
            </span>
          ) : null}
        </div>

        {productRoute ? (
          <Link
            className="inline-flex items-center rounded-full bg-black px-3.5 py-2 text-xs font-medium text-white transition hover:bg-emerald-900"
            href={productRoute}
          >
            View product
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default function AssistantProductResults({
  items,
}: {
  items: WebsiteAssistantProductResultItem[];
}) {
  return (
    <div className="mt-3 grid gap-3">
      {items.map((item) => (
        <ProductResultCard item={item} key={item.id} />
      ))}
    </div>
  );
}
