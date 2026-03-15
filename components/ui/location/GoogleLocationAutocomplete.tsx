"use client";

import {
  LoaderCircle,
  LocateFixed,
  MapPin,
  X,
  Info,
} from "lucide-react";
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
  mode = "city",
  allowCurrentLocation = true,
  className = "",
}: GoogleLocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState(getInputValue(value));
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] =
    useState(false);

  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    setQuery(getInputValue(value));
  }, [value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || disabled || !hasGoogleMapsApiKey()) return;

    let active = true;
    let subscription: { remove?: () => void } | null = null;

    void loadGoogleMapsApi()
      .then((api) => {
        if (!active || !inputRef.current || !api.maps.places?.Autocomplete)
          return;

        const autocomplete = new api.maps.places.Autocomplete(
          inputRef.current,
          {
            fields: [
              "address_components",
              "formatted_address",
              "geometry",
              "name",
              "place_id",
            ],
            types: mode === "city" ? ["(cities)"] : ["geocode"],
          }
        );

        subscription = autocomplete.addListener("place_changed", () => {
          setErrorMessage("");
          setStatusMessage("");

          void normalizePlaceSelection(
            autocomplete.getPlace(),
            mode === "city" ? "AUTOCOMPLETE" : "STAFF_PROFILE"
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
                  : "Unable to read the selected location."
              );
            });
        });
      })
      .catch((error) => {
        if (!active) return;

        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load Google Maps."
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
        throw new Error("Unable to resolve the city from your location.");
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
          : "Unable to resolve current location."
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
    <div className={`mt-1 ${className}`}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 relative">
          <label className="text-[13px] text-slate-800">{label}</label>

          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <Info className="h-3.5 w-3.5" />
          </button>

          {showInfo && (
            <div className="absolute top-6 left-0 z-10 w-65 text-xs text-slate-600 bg-white border border-slate-200 rounded shadow-md p-3">
              Use Google Places or your current location. Jade Palace stores
              only city, country, and timezone for customer accounts.
            </div>
          )}
        </div>

        {allowCurrentLocation && (
          <button
            type="button"
            onClick={() => void handleUseCurrentLocation()}
            disabled={disabled || isResolvingCurrentLocation}
            className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
          >
            {isResolvingCurrentLocation ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5" />
            )}
            Use Location
          </button>
        )}
      </div>

      {/* InputBox Styled Container */}
      <div className="w-full flex justify-between gap-3 text-sm text-black bg-slate-100 rounded px-4 py-3 mt-3 border border-slate-200">
        <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim() && value) onChange(null);
          }}
          placeholder={placeholder}
          disabled={disabled || !hasGoogleMapsApiKey()}
          className="w-full bg-transparent outline-none placeholder:text-slate-400"
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {statusMessage && (
        <p className="mt-2 text-xs text-emerald-700">{statusMessage}</p>
      )}

      {errorMessage && (
        <p className="mt-2 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}