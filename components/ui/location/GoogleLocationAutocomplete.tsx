"use client";

import { LoaderCircle, LocateFixed, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  buildLocationLabel,
  getCurrentLocationSelection,
  hasGoogleMapsApiKey,
  loadGoogleMapsApi,
  normalizePlaceSelection,
  type GoogleLocationSelection,
} from "@/lib/googleMaps";

type GoogleLocationAutocompleteProps = {
  label: string;
  value: GoogleLocationSelection | null;
  onChange: (value: GoogleLocationSelection | null) => void;
  placeholder?: string;
  disabled?: boolean;
  helperText?: string;
  mode?: "city" | "address";
  allowCurrentLocation?: boolean;
  className?: string;
};

const getInputValue = (value: GoogleLocationSelection | null) =>
  value ? buildLocationLabel(value) : "";

export default function GoogleLocationAutocomplete({
  label,
  value,
  onChange,
  placeholder = "Search a location",
  disabled = false,
  helperText,
  mode = "city",
  allowCurrentLocation = true,
  className = "",
}: GoogleLocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(getInputValue(value));
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);

  useEffect(() => {
    setQuery(getInputValue(value));
  }, [value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || disabled || !hasGoogleMapsApiKey()) {
      return;
    }

    let active = true;
    let subscription: { remove?: () => void } | null = null;

    void loadGoogleMapsApi()
      .then((api) => {
        if (!active || !inputRef.current || !api.maps.places?.Autocomplete) {
          return;
        }

        const autocomplete = new api.maps.places.Autocomplete(inputRef.current, {
          fields: ["address_components", "formatted_address", "geometry", "name", "place_id"],
          types: mode === "city" ? ["(cities)"] : ["geocode"],
        });

        subscription = autocomplete.addListener("place_changed", () => {
          setErrorMessage("");
          setStatusMessage("");

          void normalizePlaceSelection(
            autocomplete.getPlace(),
            mode === "city" ? "AUTOCOMPLETE" : "STAFF_PROFILE",
          )
            .then((selection) => {
              if (!selection.city && mode === "city") {
                throw new Error("Choose a city-level result from Google Places.");
              }

              onChange(selection);
            })
            .catch((error) => {
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : "Unable to read the selected location.",
              );
            });
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load Google Maps.",
        );
      });

    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, [disabled, mode, onChange]);

  const handleUseCurrentLocation = async () => {
    setErrorMessage("");
    setStatusMessage("");
    setIsResolvingCurrentLocation(true);

    try {
      const selection = await getCurrentLocationSelection();
      if (mode === "city" && !selection.city) {
        throw new Error("Unable to resolve the city from your current location.");
      }

      onChange({
        ...selection,
        source: mode === "city" ? "GEOLOCATION" : "STAFF_PROFILE",
      });
      setStatusMessage("Current location applied.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to resolve the current location.",
      );
    } finally {
      setIsResolvingCurrentLocation(false);
    }
  };

  const handleClear = () => {
    setErrorMessage("");
    setStatusMessage("");
    setQuery("");
    onChange(null);
  };

  return (
    <div className={className}>
      <label className="text-[13px] text-slate-800">{label}</label>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!event.target.value.trim() && value) {
                onChange(null);
              }
            }}
            placeholder={placeholder}
            disabled={disabled || !hasGoogleMapsApiKey()}
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
          />
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="rounded-full p-1 text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Clear ${label}`}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500">
            {helperText ||
              (mode === "city"
                ? "Pick a city from Google Places. Only city, country, and timezone are stored."
                : "Pick or capture the exact location. Staff map uses the precise coordinates.")}
          </div>

          {allowCurrentLocation ? (
            <button
              type="button"
              onClick={() => void handleUseCurrentLocation()}
              disabled={disabled || isResolvingCurrentLocation || !hasGoogleMapsApiKey()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResolvingCurrentLocation ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LocateFixed className="h-3.5 w-3.5" />
              )}
              Use Current Location
            </button>
          ) : null}
        </div>
      </div>

      {!hasGoogleMapsApiKey() ? (
        <p className="mt-2 text-xs text-amber-700">
          Google Maps API key is not exposed to the frontend. Set
          `NEXT_PUBLIC_GOOGLE_MAPS_PLATFORM_API_KEY` or `GOOGLE_MAPS_PLATFORM_API_KEY`, then
          restart the Next dev server. Do not use `GOOGLE_CLOUD_API_KEY` for Maps JavaScript.
        </p>
      ) : null}
      {statusMessage ? <p className="mt-2 text-xs text-emerald-700">{statusMessage}</p> : null}
      {errorMessage ? <p className="mt-2 text-xs text-red-600">{errorMessage}</p> : null}
      {value ? (
        <p className="mt-2 text-xs text-slate-500">
          Stored: {[
            value.district,
            value.city,
            value.country,
            value.timezone,
          ]
            .filter(Boolean)
            .join(" / ") || value.label}
        </p>
      ) : null}
    </div>
  );
}
