"use client";

import { LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMapsApi, type GoogleLocationSelection } from "@/lib/googleMaps";

export type GoogleMapMarker = {
  id: string;
  title: string;
  subtitle?: string | null;
  location: GoogleLocationSelection;
};

type GoogleLocationMapProps = {
  markers: GoogleMapMarker[];
  className?: string;
  zoom?: number;
};

const averageCenter = (markers: GoogleMapMarker[]) => {
  const validMarkers = markers.filter(
    (marker) =>
      marker.location.latitude !== null && marker.location.longitude !== null,
  );

  if (!validMarkers.length) {
    return { lat: 13.7563, lng: 100.5018 };
  }

  const latitude =
    validMarkers.reduce((sum, marker) => sum + (marker.location.latitude || 0), 0) /
    validMarkers.length;
  const longitude =
    validMarkers.reduce((sum, marker) => sum + (marker.location.longitude || 0), 0) /
    validMarkers.length;

  return { lat: latitude, lng: longitude };
};

export default function GoogleLocationMap({
  markers,
  className = "",
  zoom = 11,
}: GoogleLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const usableMarkers = useMemo(
    () =>
      markers.filter(
        (marker) =>
          marker.location.latitude !== null && marker.location.longitude !== null,
      ),
    [markers],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (!usableMarkers.length) {
      return;
    }

    let active = true;

    void loadGoogleMapsApi()
      .then((api) => {
        if (!active || !containerRef.current) {
          return;
        }

        const maps = api.maps as unknown as {
          Map: new (
            element: HTMLElement,
            options: Record<string, unknown>,
          ) => {
            fitBounds?: (bounds: unknown) => void;
          };
          Marker: new (options: Record<string, unknown>) => unknown;
          LatLngBounds: new () => {
            extend: (location: Record<string, number>) => void;
          };
          InfoWindow?: new (options: Record<string, unknown>) => {
            open?: (options: Record<string, unknown>) => void;
          };
        };

        const map = new maps.Map(containerRef.current, {
          center: averageCenter(usableMarkers),
          zoom,
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const bounds = new maps.LatLngBounds();

        usableMarkers.forEach((marker) => {
          const position = {
            lat: marker.location.latitude || 0,
            lng: marker.location.longitude || 0,
          };
          bounds.extend(position);
          const mapMarker = new maps.Marker({
            map,
            position,
            title: marker.title,
          });

          if (maps.InfoWindow) {
            const infoWindow = new maps.InfoWindow({
              content: `
                <div style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 4px 6px; min-width: 180px;">
                  <div style="font-weight: 600; color: #0f172a;">${marker.title}</div>
                  <div style="margin-top: 4px; font-size: 12px; color: #475569;">
                    ${marker.subtitle || marker.location.label}
                  </div>
                </div>
              `,
            });

            const clickableMarker = mapMarker as {
              addListener?: (eventName: string, handler: () => void) => void;
            };
            clickableMarker.addListener?.("click", () => {
              infoWindow.open?.({
                anchor: mapMarker,
                map,
              });
            });
          }
        });

        if (usableMarkers.length > 1) {
          map.fitBounds?.(bounds);
        }

        setErrorMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Unable to render the Google map.",
        );
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [usableMarkers, zoom]);

  if (!usableMarkers.length) {
    return (
      <div
        className={`flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 ${className}`}
      >
        No precise coordinates available yet.
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${className}`}>
      <div ref={containerRef} className="min-h-[240px] w-full" />
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading map
          </div>
        </div>
      ) : null}
      {errorMessage ? (
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-red-200 bg-white/95 px-3 py-2 text-xs text-red-700 shadow-sm">
          <div className="inline-flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            {errorMessage}
          </div>
        </div>
      ) : null}
    </div>
  );
}
