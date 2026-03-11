"use client";

import { X } from "lucide-react";
import GoogleLocationMap, {
  type GoogleMapMarker,
} from "@/components/ui/location/GoogleLocationMap";

type LocationMapDialogProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  markers: GoogleMapMarker[];
  onClose: () => void;
};

export default function LocationMapDialog({
  open,
  title,
  subtitle,
  markers,
  onClose,
}: LocationMapDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-[2rem] border border-slate-200 bg-white shadow-[0_32px_120px_-56px_rgba(15,23,42,0.8)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Google Map View
            </p>
            <h2 className="mt-2 text-2xl font-light text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            aria-label="Close map view"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          <GoogleLocationMap markers={markers} className="min-h-[480px]" />
        </div>
      </div>
    </div>
  );
}

