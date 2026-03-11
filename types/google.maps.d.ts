declare global {
  interface Window {
    google?: typeof google;
  }

  namespace google.maps {
    class LatLng {
      lat(): number;
      lng(): number;
    }

    namespace event {
      function clearInstanceListeners(instance: unknown): void;
    }

    class Map {
      constructor(element: HTMLElement, options?: MapOptions);
      setCenter(latLng: LatLngLiteral): void;
      setZoom(zoom: number): void;
      fitBounds(bounds: LatLngBounds): void;
    }

    interface MapOptions {
      center?: LatLngLiteral;
      zoom?: number;
      disableDefaultUI?: boolean;
      gestureHandling?: string;
      mapId?: string;
    }

    class Marker {
      constructor(options?: MarkerOptions);
      setMap(map: Map | null): void;
      setPosition(position: LatLngLiteral): void;
    }

    interface MarkerOptions {
      map?: Map | null;
      position?: LatLngLiteral;
      title?: string;
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class LatLngBounds {
      extend(value: LatLngLiteral): void;
    }

    class Geocoder {
      geocode(
        request: GeocoderRequest,
        callback: (
          results: GeocoderResult[] | null,
          status: GeocoderStatus,
        ) => void,
      ): void;
    }

    interface GeocoderRequest {
      location?: LatLngLiteral;
      placeId?: string;
      address?: string;
    }

    interface GeocoderResult {
      address_components: GeocoderAddressComponent[];
      formatted_address: string;
      geometry: {
        location: LatLng;
      };
      place_id?: string;
      name?: string;
    }

    interface GeocoderAddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }

    type GeocoderStatus = "OK" | "ZERO_RESULTS" | "ERROR";

    namespace places {
      class Autocomplete {
        constructor(inputField: HTMLInputElement, options?: AutocompleteOptions);
        addListener(eventName: string, handler: () => void): { remove(): void };
        getPlace(): PlaceResult;
      }

      interface AutocompleteOptions {
        fields?: string[];
        types?: string[];
      }

      interface PlaceResult {
        address_components?: GeocoderAddressComponent[];
        formatted_address?: string;
        geometry?: {
          location?: LatLng;
        };
        name?: string;
        place_id?: string;
      }
    }
  }
}

export {};
