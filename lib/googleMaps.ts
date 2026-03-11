export type GoogleLocationMode = "city" | "address";

export type GoogleLocationSelection = {
  label: string;
  district: string;
  city: string;
  country: string;
  timezone: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  source: string;
};

export type ResolvedGoogleLocation = {
  district: string;
  city: string;
  country: string;
  timezone: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  source: "autocomplete" | "geolocation";
};

const GOOGLE_MAPS_SCRIPT_ID = "jade-palace-google-maps";
const GOOGLE_MAPS_CALLBACK_NAME = "__jadePalaceGoogleMapsInit";

let googleMapsLoadPromise: Promise<typeof google> | null = null;

const getGoogleMapsApiKey = () =>
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_PLATFORM_API_KEY || "";

const resolveGoogleMaps = () => {
  if (typeof window === "undefined" || !window.google?.maps) {
    return null;
  }

  return window.google;
};

export const hasGoogleMapsPlatformKey = () => Boolean(getGoogleMapsApiKey());

export const loadGoogleMaps = async (): Promise<typeof google> => {
  const existingGoogle = resolveGoogleMaps();
  if (existingGoogle) {
    return existingGoogle;
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error(
      "Google Maps API key is missing. Set NEXT_PUBLIC_GOOGLE_MAPS_PLATFORM_API_KEY or GOOGLE_MAPS_PLATFORM_API_KEY. Do not use GOOGLE_CLOUD_API_KEY for the browser Maps JavaScript API.",
    );
  }

  googleMapsLoadPromise = new Promise<typeof google>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Maps can only load in the browser."));
      return;
    }

    const onReady = () => {
      const googleMaps = resolveGoogleMaps();
      if (!googleMaps) {
        reject(new Error("Google Maps loaded without the maps runtime."));
        return;
      }

      resolve(googleMaps);
    };

    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", onReady, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps.")),
        { once: true },
      );
      return;
    }

    const callbackName = GOOGLE_MAPS_CALLBACK_NAME;
    Object.assign(window, {
      [callbackName]: onReady,
    });

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src =
      "https://maps.googleapis.com/maps/api/js?" +
      new URLSearchParams({
        key: apiKey,
        libraries: "places",
        callback: callbackName,
      }).toString();
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  }).finally(() => {
    if (typeof window !== "undefined") {
      const callbackName = GOOGLE_MAPS_CALLBACK_NAME;
      if (callbackName in window) {
        delete (window as typeof window & Record<string, unknown>)[callbackName];
      }
    }
  });

  return googleMapsLoadPromise;
};

const resolveAddressComponent = (
  addressComponents: google.maps.GeocoderAddressComponent[] | undefined,
  candidates: string[],
) => {
  if (!Array.isArray(addressComponents)) {
    return "";
  }

  for (const candidate of candidates) {
    const match = addressComponents.find((component) =>
      Array.isArray(component.types) && component.types.includes(candidate),
    );
    if (match?.long_name) {
      return match.long_name;
    }
  }

  return "";
};

const normalizeLocationToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase();

const resolveAddressComponentAcrossPlaces = (
  addressComponentsList: Array<google.maps.GeocoderAddressComponent[] | undefined>,
  candidates: string[],
  blockedTokens: string[] = [],
) => {
  const blocked = new Set(blockedTokens.filter(Boolean));

  for (const addressComponents of addressComponentsList) {
    const match = resolveAddressComponent(addressComponents, candidates);
    if (!match) {
      continue;
    }

    if (blocked.has(normalizeLocationToken(match))) {
      continue;
    }

    return match;
  }

  return "";
};

const resolveDistrict = (
  addressComponents: google.maps.GeocoderAddressComponent[] | undefined,
) =>
  resolveAddressComponent(addressComponents, [
    "sublocality_level_1",
    "sublocality",
    "sublocality_level_2",
    "administrative_area_level_3",
    "neighborhood",
  ]);

const resolveCity = (
  addressComponents: google.maps.GeocoderAddressComponent[] | undefined,
  fallbackPlaces: Array<google.maps.GeocoderResult | google.maps.places.PlaceResult> = [],
) => {
  const fallbackAddressComponents = fallbackPlaces.map((place) => place.address_components);
  const district = resolveDistrict(addressComponents);
  const districtToken = normalizeLocationToken(district);

  const directLocality = resolveAddressComponent(addressComponents, [
    "locality",
    "postal_town",
  ]);
  if (directLocality) {
    return directLocality;
  }

  const fallbackLocality = resolveAddressComponentAcrossPlaces(
    fallbackAddressComponents,
    ["locality", "postal_town"],
    [districtToken],
  );
  if (fallbackLocality) {
    return fallbackLocality;
  }

  const directAdminLevel2 = resolveAddressComponent(addressComponents, [
    "administrative_area_level_2",
  ]);
  if (
    directAdminLevel2 &&
    normalizeLocationToken(directAdminLevel2) !== districtToken
  ) {
    return directAdminLevel2;
  }

  const fallbackAdminLevel2 = resolveAddressComponentAcrossPlaces(
    fallbackAddressComponents,
    ["administrative_area_level_2"],
    [districtToken],
  );
  if (fallbackAdminLevel2) {
    return fallbackAdminLevel2;
  }

  const directAdminLevel1 = resolveAddressComponent(addressComponents, [
    "administrative_area_level_1",
  ]);
  if (
    directAdminLevel1 &&
    normalizeLocationToken(directAdminLevel1) !== districtToken
  ) {
    return directAdminLevel1;
  }

  const fallbackAdminLevel1 = resolveAddressComponentAcrossPlaces(
    fallbackAddressComponents,
    ["administrative_area_level_1"],
    [districtToken],
  );
  if (fallbackAdminLevel1) {
    return fallbackAdminLevel1;
  }

  return directAdminLevel2 || directAdminLevel1 || district;
};

const resolveCountry = (
  addressComponents: google.maps.GeocoderAddressComponent[] | undefined,
) => resolveAddressComponent(addressComponents, ["country"]);

const resolveFormattedAddress = (
  place: google.maps.places.PlaceResult | google.maps.GeocoderResult,
) => place.formatted_address || place.name || null;

export const resolveBrowserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const resolveTimeZoneForCoordinates = async ({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return resolveBrowserTimeZone();
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const url =
    "https://maps.googleapis.com/maps/api/timezone/json?" +
    new URLSearchParams({
      location: `${latitude},${longitude}`,
      timestamp: String(timestamp),
      key: apiKey,
    }).toString();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return resolveBrowserTimeZone();
    }

    const payload = (await response.json().catch(() => null)) as
      | { status?: string; timeZoneId?: string }
      | null;
    if (payload?.status === "OK" && payload.timeZoneId) {
      return payload.timeZoneId;
    }
  } catch {
    return resolveBrowserTimeZone();
  }

  return resolveBrowserTimeZone();
};

export const extractResolvedGoogleLocation = async ({
  place,
  source,
  fallbackPlaces = [],
}: {
  place: google.maps.places.PlaceResult | google.maps.GeocoderResult;
  source: ResolvedGoogleLocation["source"];
  fallbackPlaces?: Array<google.maps.GeocoderResult | google.maps.places.PlaceResult>;
}): Promise<ResolvedGoogleLocation> => {
  const addressComponents = place.address_components;
  const latitude = place.geometry?.location?.lat?.() ?? null;
  const longitude = place.geometry?.location?.lng?.() ?? null;
  const timezone =
    latitude !== null && longitude !== null
      ? await resolveTimeZoneForCoordinates({ latitude, longitude })
      : resolveBrowserTimeZone();

  return {
    district: resolveDistrict(addressComponents),
    city: resolveCity(addressComponents, fallbackPlaces),
    country: resolveCountry(addressComponents),
    timezone,
    formattedAddress: resolveFormattedAddress(place),
    latitude,
    longitude,
    placeId: place.place_id || null,
    source,
  };
};

export const reverseGeocodeCurrentPosition = async ({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) => {
  const googleMaps = await loadGoogleMaps();

  return new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
    const geocoder = new googleMaps.maps.Geocoder();
    geocoder.geocode(
      {
        location: {
          lat: latitude,
          lng: longitude,
        },
      },
      (results, status) => {
        if (status !== "OK" || !results?.length) {
          reject(new Error("Unable to resolve your location."));
          return;
        }

        resolve(results);
      },
    );
  });
};

export const resolveCurrentPositionLocation = async () => {
  if (typeof window === "undefined" || !navigator.geolocation) {
    throw new Error("Browser geolocation is not available.");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 10_000,
    });
  });

  const results = await reverseGeocodeCurrentPosition({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });

  return extractResolvedGoogleLocation({
    place: results[0],
    source: "geolocation",
    fallbackPlaces: results.slice(1),
  });
};

export const geocodeAddress = async (address: string) => {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    return null;
  }

  const googleMaps = await loadGoogleMaps();

  const result = await new Promise<google.maps.GeocoderResult | null>((resolve, reject) => {
    const geocoder = new googleMaps.maps.Geocoder();
    geocoder.geocode(
      {
        address: trimmedAddress,
      },
      (results, status) => {
        if (status === "ZERO_RESULTS") {
          resolve(null);
          return;
        }

        if (status !== "OK" || !results?.length) {
          reject(new Error("Unable to geocode the provided location."));
          return;
        }

        resolve(results[0]);
      },
    );
  });

  if (!result) {
    return null;
  }

  return normalizePlaceSelection(result, "GEOCODER");
};

export const haversineDistanceKm = (
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const startLatitude = toRadians(first.latitude);
  const endLatitude = toRadians(second.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const resolveAutocompleteTypes = (mode: GoogleLocationMode) =>
  mode === "city" ? ["(cities)"] : ["geocode"];

export const resolveLocationLabel = ({
  district,
  city,
  country,
}: {
  district?: string | null;
  city?: string | null;
  country?: string | null;
}) => {
  const seen = new Set<string>();

  return [district, city, country]
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value) {
        return false;
      }

      const token = value.toLowerCase();
      if (seen.has(token)) {
        return false;
      }

      seen.add(token);
      return true;
    })
    .join(", ");
};

export const buildLocationLabel = (
  selection:
    | {
        district?: string | null;
        city?: string | null;
        country?: string | null;
        formattedAddress?: string | null;
        label?: string | null;
      }
    | null,
) => {
  if (!selection) {
    return "";
  }

  return (
    resolveLocationLabel(selection) ||
    selection.label ||
    selection.formattedAddress ||
    ""
  );
};

export const createLocationSelectionFromValues = ({
  district,
  city,
  country,
  timezone,
  latitude = null,
  longitude = null,
  formattedAddress = null,
  placeId = null,
  label = "",
  source = "PROFILE",
}: {
  district?: string | null;
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  placeId?: string | null;
  label?: string | null;
  source?: string;
}) => {
  const nextDistrict = district || "";
  const nextCity = city || "";
  const nextCountry = country || "";
  const nextTimezone = timezone || "";
  const nextLabel =
    label ||
    resolveLocationLabel({
      district: nextDistrict,
      city: nextCity,
      country: nextCountry,
    });

  if (
    !nextDistrict &&
    !nextCity &&
    !nextCountry &&
    !nextTimezone &&
    latitude === null &&
    longitude === null &&
    !formattedAddress &&
    !placeId &&
    !nextLabel
  ) {
    return null;
  }

  return {
    label: nextLabel,
    district: nextDistrict,
    city: nextCity,
    country: nextCountry,
    timezone: nextTimezone,
    formattedAddress,
    latitude,
    longitude,
    placeId,
    source,
  } satisfies GoogleLocationSelection;
};

export const normalizeStoredLocationSelection = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const address =
    row.address && typeof row.address === "object" && !Array.isArray(row.address)
      ? (row.address as Record<string, unknown>)
      : null;
  const components =
    row.components && typeof row.components === "object" && !Array.isArray(row.components)
      ? (row.components as Record<string, unknown>)
      : null;
  const latitude =
    typeof row.latitude === "number"
      ? row.latitude
      : typeof row.lat === "number"
        ? row.lat
        : null;
  const longitude =
    typeof row.longitude === "number"
      ? row.longitude
      : typeof row.lng === "number"
        ? row.lng
        : null;

  return createLocationSelectionFromValues({
    district:
      typeof row.district === "string"
        ? row.district
        : typeof address?.district === "string"
          ? address.district
          : typeof components?.district === "string"
            ? components.district
            : null,
    city: typeof row.city === "string" ? row.city : null,
    country: typeof row.country === "string" ? row.country : null,
    timezone:
      typeof row.timezone === "string"
        ? row.timezone
        : typeof row.timezoneId === "string"
          ? row.timezoneId
          : null,
    latitude,
    longitude,
    formattedAddress:
      typeof row.formattedAddress === "string"
        ? row.formattedAddress
        : typeof row.address === "string"
          ? row.address
          : typeof address?.formattedAddress === "string"
            ? address.formattedAddress
          : null,
    placeId: typeof row.placeId === "string" ? row.placeId : null,
    label:
      typeof row.locationLabel === "string"
        ? row.locationLabel
        : typeof row.label === "string"
          ? row.label
          : "",
    source: typeof row.source === "string" ? row.source : "PROFILE",
  });
};

export const normalizeExactLocationRecord = normalizeStoredLocationSelection;

const toLocationSelection = (
  location: ResolvedGoogleLocation,
  source: string,
): GoogleLocationSelection => ({
  label:
    resolveLocationLabel({
      district: location.district,
      city: location.city,
      country: location.country,
    }) ||
    location.formattedAddress ||
    "",
  district: location.district,
  city: location.city,
  country: location.country,
  timezone: location.timezone,
  formattedAddress: location.formattedAddress,
  latitude: location.latitude,
  longitude: location.longitude,
  placeId: location.placeId,
  source,
});

export const normalizePlaceSelection = async (
  place: google.maps.places.PlaceResult | google.maps.GeocoderResult,
  source = "AUTOCOMPLETE",
) => toLocationSelection(
  await extractResolvedGoogleLocation({
    place,
    source: "autocomplete",
  }),
  source,
);

export const getCurrentLocationSelection = async (source = "GEOLOCATION") =>
  toLocationSelection(await resolveCurrentPositionLocation(), source);

export const hasGoogleMapsApiKey = hasGoogleMapsPlatformKey;
export const loadGoogleMapsApi = loadGoogleMaps;
