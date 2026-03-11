"use client";

type LocationMapPreviewProps = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  title?: string;
  subtitle?: string;
  className?: string;
};

export default function LocationMapPreview({
  latitude,
  longitude,
  title = "Map preview",
  subtitle = "",
  className = "",
}: LocationMapPreviewProps) {
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return (
      <div
        className={`flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 ${className}`.trim()}
      >
        Location coordinates are not available yet.
      </div>
    );
  }

  const src = `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`.trim()}>
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <iframe
        title={title}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-72 w-full border-0"
      />
    </div>
  );
}
