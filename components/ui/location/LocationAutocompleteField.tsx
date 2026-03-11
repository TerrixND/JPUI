"use client";

import {
  extractResolvedGoogleLocation,
  hasGoogleMapsPlatformKey,
  loadGoogleMaps,
  resolveAutocompleteTypes,
  resolveCurrentPositionLocation,
  type GoogleLocationMode,
  type ResolvedGoogleLocation,
} from "@/lib/googleMaps";
import { LoaderCircle, LocateFixed, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type LocationAutocompleteFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onInputChange: (value: string) => void;
  onResolved: (location: ResolvedGoogleLocation) => void;
  disabled?: boolean;
  mode?: GoogleLocationMode;
  helperText?: string;
  actionLabel?: string;
  className?: string;
};

export default function LocationAutocompleteField({
  label,
  placeholder,
  value,
  onInputChange,
  onResolved,
  disabled = false,
  mode = "city",
  helperText = "",
  actionLabel = "Use my location",
  className = "",
}: LocationAutocompleteFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (disabled || !inputRef.current || !hasGoogleMapsPlatformKey()) {
      return;
    }

    let disposed = false;
    let listener: { remove(): void } | null = null;

    const attachAutocomplete = async () => {
      setIsLoadingMaps(true);
      setError("");

      try {
        const googleMaps = await loadGoogleMaps();
        if (disposed || !inputRef.current) {
          return;
        }

        const autocomplete = new googleMaps.maps.places.Autocomplete(inputRef.current, {
          fields: ["address_components", "formatted_address", "geometry", "name", "place_id"],
          types: resolveAutocompleteTypes(mode),
        });

        listener = autocomplete.addListener("place_changed", async () => {
          try {
            const place = autocomplete.getPlace();
            if (!place?.geometry?.location) {
              return;
            }

            const nextLocation = await extractResolvedGoogleLocation({
              place,
              source: "autocomplete",
            });
            onResolved(nextLocation);
            onInputChange(nextLocation.city || nextLocation.formattedAddress || value);
            setError("");
          } catch (caughtError) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Failed to resolve this location.",
            );
          }
        });
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load Google Maps.",
        );
      } finally {
        if (!disposed) {
          setIsLoadingMaps(false);
        }
      }
    };

    void attachAutocomplete();

    return () => {
      disposed = true;
      listener?.remove();
    };
  }, [disabled, mode, onInputChange, onResolved, value]);

  const handleUseCurrentLocation = async () => {
    setIsResolvingCurrentLocation(true);
    setError("");

    try {
      const nextLocation = await resolveCurrentPositionLocation();
      onResolved(nextLocation);
      onInputChange(nextLocation.city || nextLocation.formattedAddress || value);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to get your current location.",
      );
    } finally {
      setIsResolvingCurrentLocation(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
            <MapPin className="h-4 w-4 text-emerald-600" />
            {label}
          </label>
          {helperText ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">{helperText}</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={disabled || isResolvingCurrentLocation}
          onClick={() => void handleUseCurrentLocation()}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResolvingCurrentLocation ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LocateFixed className="h-3.5 w-3.5" />
          )}
          {actionLabel}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        {isLoadingMaps ? <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" /> : null}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
      </div>

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      {!hasGoogleMapsPlatformKey() ? (
        <p className="mt-2 text-xs text-amber-700">
          Google Maps key is not exposed to the browser yet, so autocomplete is unavailable.
        </p>
      ) : null}
    </div>
  );
}
