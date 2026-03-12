"use client";

import useAuth from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import {
  ApiClientError,
  createPublicAppointment,
  getPublicAppointmentAutofill,
  getPublicBranches,
  getPublicMediaUrl,
  getUserMe,
  mapPageContextToMediaSection,
  type PublicBranchRecord,
} from "@/lib/apiClient";
import { startLineOAuth } from "@/lib/lineAuth";
import {
  geocodeAddress,
  haversineDistanceKm,
  normalizeStoredLocationSelection,
  resolveLocationLabel,
} from "@/lib/googleMaps";
import supabase from "@/lib/supabase";
import { ArrowRight, LoaderCircle, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type AppointmentFormState = {
  branchId: string;
  appointmentDate: string;
  preferredContact: "EMAIL" | "PHONE" | "LINE";
  name: string;
  email: string;
  phone: string;
  lineId: string;
  language: string;
  userEnteredCity: string;
  notes: string;
};

const MEDIA_SECTION = mapPageContextToMediaSection("PRODUCT_DETAIL");
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="100%" height="100%" fill="#f5f5f4"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#a8a29e" font-family="serif" font-size="22" letter-spacing="5">JADE PALACE</text></svg>',
  );

const toLocalDateTimeValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const createDefaultAppointmentValue = () => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(11, 0, 0, 0);
  return toLocalDateTimeValue(next);
};

const createMinAppointmentValue = () => {
  const next = new Date(Date.now() + 30 * 60 * 1000);
  next.setSeconds(0, 0);
  return toLocalDateTimeValue(next);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const asOptionalText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const branchGeoCache = new Map<string, Promise<{ latitude: number; longitude: number } | null>>();

const normalizeToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase();

const resolveDefaultPreferredContact = ({
  lineId,
  phone,
  lineReady = false,
}: {
  lineId?: string | null;
  phone?: string | null;
  lineReady?: boolean;
}) => {
  if (lineReady || normalizeToken(lineId)) return "LINE" as const;
  if (normalizeToken(phone)) return "PHONE" as const;
  return "EMAIL" as const;
};

const getBranchGeocode = async (branch: PublicBranchRecord) => {
  if (branchGeoCache.has(branch.id)) {
    return branchGeoCache.get(branch.id) || Promise.resolve(null);
  }

  const lookupPromise = geocodeAddress(
    [branch.address, branch.city, branch.name].filter(Boolean).join(", "),
  )
    .then((selection) => {
      if (selection?.latitude === null || selection?.longitude === null || !selection) {
        return null;
      }

      return {
        latitude: selection.latitude,
        longitude: selection.longitude,
      };
    })
    .catch(() => null);

  branchGeoCache.set(branch.id, lookupPromise);
  return lookupPromise;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

const branchLabel = (branch: PublicBranchRecord | null | undefined) => {
  if (!branch) return "Select a branch";
  return [branch.name || branch.code || "Private showroom", branch.city, branch.address]
    .filter(Boolean)
    .join(" / ");
};

function CartPageContent() {
  const authUser = useAuth() as { id?: string | null } | null;
  const searchParams = useSearchParams();
  const { items, count, removeItem, clear } = useCart();
  const [branches, setBranches] = useState<PublicBranchRecord[]>([]);
  const [cartImages, setCartImages] = useState<Record<string, string>>({});
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isCustomerSession, setIsCustomerSession] = useState(false);
  const [tierLabel, setTierLabel] = useState("");
  const [customerCountry, setCustomerCountry] = useState("");
  const [customerLocationDistrict, setCustomerLocationDistrict] = useState("");
  const [customerLineUserId, setCustomerLineUserId] = useState("");
  const [customerLineVerifiedAt, setCustomerLineVerifiedAt] = useState("");
  const [branchSelectionNote, setBranchSelectionNote] = useState("");
  const [isResolvingBranch, setIsResolvingBranch] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingLine, setIsConnectingLine] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lineConnectionMessage, setLineConnectionMessage] = useState("");
  const [form, setForm] = useState<AppointmentFormState>({
    branchId: "",
    appointmentDate: createDefaultAppointmentValue(),
    preferredContact: "EMAIL",
    name: "",
    email: "",
    phone: "",
    lineId: "",
    language: "English",
    userEnteredCity: "",
    notes: "",
  });

  const minAppointmentValue = useMemo(() => createMinAppointmentValue(), []);
  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === form.branchId) ?? null,
    [branches, form.branchId],
  );
  const skuList = useMemo(
    () => items.map((item) => item.sku).filter((sku): sku is string => Boolean(sku)),
    [items],
  );
  const missingLockedProfileFields = useMemo(
    () =>
      isCustomerSession
        ? [
            !form.name.trim() ? "full name" : null,
            !form.email.trim() ? "email" : null,
            !form.phone.trim() ? "phone" : null,
            !form.lineId.trim() ? "LINE ID" : null,
            !form.language.trim() ? "language" : null,
            !form.userEnteredCity.trim() ? "city" : null,
          ].filter((value): value is string => Boolean(value))
        : [],
    [
      form.email,
      form.language,
      form.lineId,
      form.name,
      form.phone,
      form.userEnteredCity,
      isCustomerSession,
    ],
  );
  const isLineReadyForContact = Boolean(customerLineUserId && customerLineVerifiedAt);
  const preferredContactBlockingMessage = useMemo(() => {
    if (form.preferredContact === "EMAIL" && !form.email.trim()) {
      return "Add an email address before using Email as the preferred contact method.";
    }

    if (form.preferredContact === "PHONE" && !form.phone.trim()) {
      return "Add a phone number before using Phone as the preferred contact method.";
    }

    if (form.preferredContact === "LINE") {
      if (!isCustomerSession) {
        return "LINE contact is available only for signed-in customer accounts.";
      }

      if (!isLineReadyForContact) {
        return "Connect and verify your LINE account before using LINE as the preferred contact method.";
      }
    }

    return "";
  }, [
    form.email,
    form.phone,
    form.preferredContact,
    isCustomerSession,
    isLineReadyForContact,
  ]);
  const canSubmitAppointment =
    Boolean(form.branchId) &&
    Boolean(form.appointmentDate) &&
    (isCustomerSession || (Boolean(form.name.trim()) && Boolean(form.email.trim()))) &&
    !preferredContactBlockingMessage;
  const staffFacingLocationLabel = useMemo(
    () =>
      resolveLocationLabel({
        district: customerLocationDistrict,
        city: form.userEnteredCity,
        country: customerCountry,
      }),
    [customerCountry, customerLocationDistrict, form.userEnteredCity],
  );

  useEffect(() => {
    let cancelled = false;

    const loadPageData = async () => {
      setIsBootstrapping(true);

      try {
        const branchesPromise = getPublicBranches();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const token = session?.access_token ?? null;
        const metadataLocation = normalizeStoredLocationSelection(
          session?.user?.user_metadata,
        );
        const [autofill, branchRows, accountDetails] = await Promise.all([
          getPublicAppointmentAutofill({
            accessToken: token ?? undefined,
          }),
          branchesPromise,
          token ? getUserMe({ accessToken: token }).catch(() => null) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const customerAccountDetails = autofill.canAutofill ? accountDetails : null;
        setBranches(branchRows);
        setAccessToken(token);
        setIsCustomerSession(autofill.canAutofill);
        setTierLabel(String(autofill.data?.tier || "").replace(/_/g, " "));
        setCustomerCountry(autofill.data?.country || "");
        setCustomerLocationDistrict(metadataLocation?.district || "");
        setCustomerLineUserId(customerAccountDetails?.lineUserId || "");
        setCustomerLineVerifiedAt(customerAccountDetails?.lineOfficialVerifiedAt || "");
        setForm((current) => ({
          ...current,
          branchId:
            branchRows.some((branch) => branch.id === current.branchId)
              ? current.branchId
              : branchRows[0]?.id || "",
          name: current.name || autofill.data?.name || "",
          email: current.email || autofill.data?.email || session?.user?.email || "",
          phone: current.phone || autofill.data?.phone || "",
          lineId: current.lineId || autofill.data?.lineId || "",
          language: current.language || autofill.data?.language || "English",
          userEnteredCity: current.userEnteredCity || autofill.data?.city || "",
          preferredContact: resolveDefaultPreferredContact({
            lineId: current.lineId || autofill.data?.lineId || "",
            phone: current.phone || autofill.data?.phone || "",
            lineReady: Boolean(
              customerAccountDetails?.lineUserId &&
                customerAccountDetails?.lineOfficialVerifiedAt,
            ),
          }),
        }));
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error, "Failed to load appointment details."));
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void loadPageData();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (searchParams.get("lineConnected") === "1") {
      setLineConnectionMessage(
        "LINE account connected and verified. You can now use LINE as your preferred contact method.",
      );
    }

    const lineConnectError = String(searchParams.get("lineConnectError") || "").trim();
    if (lineConnectError) {
      setErrorMessage(lineConnectError);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const refreshImages = async () => {
      const nextEntries = await Promise.all(
        items.map(async (item) => {
          if (!item.imageId) {
            return item.imageUrl ? ([item.id, item.imageUrl] as const) : null;
          }

          try {
            const media = await getPublicMediaUrl(item.imageId, MEDIA_SECTION, {
              accessToken: accessToken ?? undefined,
            });
            return [item.id, media.url] as const;
          } catch {
            return item.imageUrl ? ([item.id, item.imageUrl] as const) : null;
          }
        }),
      );

      if (cancelled) return;

      setCartImages(
        nextEntries.reduce<Record<string, string>>((acc, entry) => {
          if (entry) acc[entry[0]] = entry[1];
          return acc;
        }, {}),
      );
    };

    void refreshImages();

    return () => {
      cancelled = true;
    };
  }, [items, accessToken]);

  useEffect(() => {
    if (!isCustomerSession || branches.length === 0) {
      return;
    }

    let cancelled = false;

    const assignBranch = async () => {
      const cityToken = normalizeToken(form.userEnteredCity);
      const exactCityMatch = cityToken
        ? branches.find((branch) => normalizeToken(branch.city) === cityToken) || null
        : null;

      if (exactCityMatch) {
        if (!cancelled) {
          setForm((current) => ({
            ...current,
            branchId: exactCityMatch.id,
          }));
          setBranchSelectionNote(
            `Assigned to ${exactCityMatch.name || "the nearest showroom"} from your profile city.`,
          );
        }
        return;
      }

      const locationQuery = [form.userEnteredCity, customerCountry].filter(Boolean).join(", ").trim();
      if (!locationQuery) {
        const fallbackBranch = branches[0] || null;
        if (!cancelled && fallbackBranch) {
          setForm((current) => ({
            ...current,
            branchId: fallbackBranch.id,
          }));
          setBranchSelectionNote(
            `Assigned to ${fallbackBranch.name || "the first active showroom"} while your account location is still empty.`,
          );
        }
        return;
      }

      setIsResolvingBranch(true);
      try {
        const customerLocation = await geocodeAddress(locationQuery);
        if (!customerLocation || customerLocation.latitude === null || customerLocation.longitude === null) {
          throw new Error("Missing coordinates for customer location.");
        }
        const customerCoordinates = {
          latitude: customerLocation.latitude,
          longitude: customerLocation.longitude,
        };

        const branchLocations = await Promise.all(
          branches.map(async (branch) => ({
            branch,
            location: await getBranchGeocode(branch),
          })),
        );

        const ranked = branchLocations
          .filter(
            (entry): entry is { branch: PublicBranchRecord; location: { latitude: number; longitude: number } } =>
              Boolean(entry.location),
          )
          .map((entry) => ({
            branch: entry.branch,
            distanceKm: haversineDistanceKm(
              customerCoordinates,
              entry.location,
            ),
          }))
          .sort((first, second) => first.distanceKm - second.distanceKm);

        const fallbackBranch = ranked[0]?.branch || branches[0] || null;
        if (!cancelled && fallbackBranch) {
          setForm((current) => ({
            ...current,
            branchId: fallbackBranch.id,
          }));
          setBranchSelectionNote(
            ranked[0]
              ? `Assigned to ${fallbackBranch.name || "the closest showroom"} based on your account location.`
              : `Assigned to ${fallbackBranch.name || "the first active showroom"} because a location match was not available.`,
          );
        }
      } catch {
        const fallbackBranch = branches[0] || null;
        if (!cancelled && fallbackBranch) {
          setForm((current) => ({
            ...current,
            branchId: fallbackBranch.id,
          }));
          setBranchSelectionNote(
            `Assigned to ${fallbackBranch.name || "the first active showroom"} while Google location matching finishes.`,
          );
        }
      } finally {
        if (!cancelled) {
          setIsResolvingBranch(false);
        }
      }
    };

    void assignBranch();

    return () => {
      cancelled = true;
    };
  }, [branches, customerCountry, form.userEnteredCity, isCustomerSession]);

  const updateForm = <Key extends keyof AppointmentFormState>(
    key: Key,
    value: AppointmentFormState[Key],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleConnectLine = async () => {
    setErrorMessage("");
    setLineConnectionMessage("");
    setIsConnectingLine(true);

    try {
      await startLineOAuth({
        intent: "connect",
        returnTo: "/cart",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start LINE connection.",
      );
      setIsConnectingLine(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      if (preferredContactBlockingMessage) {
        throw new Error(preferredContactBlockingMessage);
      }

      const appointmentDate = new Date(form.appointmentDate);
      if (Number.isNaN(appointmentDate.getTime())) {
        throw new Error("Choose a valid appointment date and time.");
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const appointment = await createPublicAppointment({
        accessToken: session?.access_token ?? undefined,
        payload: {
          branchId: form.branchId,
          appointmentDate: appointmentDate.toISOString(),
          productIds: items.map((item) => item.id),
          preferredContact: form.preferredContact,
          name: asOptionalText(form.name),
          email: asOptionalText(form.email),
          phone: asOptionalText(form.phone),
          lineId: asOptionalText(form.lineId),
          language: asOptionalText(form.language),
          userEnteredCity: asOptionalText(form.userEnteredCity),
          autoLocatedCity: asOptionalText(staffFacingLocationLabel || form.userEnteredCity),
          notes: asOptionalText(form.notes),
        },
      });

      setSuccessMessage(
        `Appointment request submitted for ${formatDateTime(appointment.appointmentDate)} at ${
          appointment.branch?.name || "your selected branch"
        }.`,
      );
      clear();
      setForm((current) => ({
        ...current,
        appointmentDate: createDefaultAppointmentValue(),
        notes: "",
      }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to submit appointment request."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f5f5f4_0%,#ffffff_52%,#ecfdf5_100%)] text-stone-900">
      <section className="px-6 pb-8 pt-24 sm:px-12 lg:px-20">
        <div className="rounded-[2rem] border border-stone-200 bg-white/90 p-8 shadow-[0_24px_80px_-48px_rgba(28,25,23,0.48)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-700">
              Customer Appointment
            </span>
            {isCustomerSession && tierLabel ? (
              <span className="rounded-full border border-stone-200 bg-stone-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-600">
                {tierLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h1 className="max-w-3xl text-4xl font-light leading-tight sm:text-5xl">
                Curate your showroom visit and send one polished request.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                Keep selected jade pieces in one cart, choose a time, and let the concierge team
                confirm availability before the appointment is locked in.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-stone-200 bg-[linear-gradient(145deg,#fafaf9_0%,#f0fdf4_60%,#ecfccb_100%)] p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Pieces</p>
                  <p className="mt-2 text-2xl font-medium">{count}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Branch</p>
                  <p className="mt-2 text-sm font-medium">
                    {selectedBranch?.name ||
                      (isCustomerSession
                        ? isResolvingBranch
                          ? "Assigning showroom"
                          : "Assigned automatically"
                        : "Choose one")}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">Visit Time</p>
                  <p className="mt-2 text-sm font-medium">{formatDateTime(form.appointmentDate)}</p>
                </div>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
          {successMessage ? (
            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p>{successMessage}</p>
              {isCustomerSession ? (
                <Link
                  href="/appointment"
                  className="mt-3 inline-flex items-center gap-2 font-medium text-emerald-800 hover:text-emerald-900"
                >
                  Open Appointment Page
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ) : null}
          {lineConnectionMessage ? (
            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {lineConnectionMessage}
            </div>
          ) : null}
        </div>
      </section>

      <section className="px-6 pb-16 sm:px-12 lg:px-20">
        <div className="grid items-start gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-[0_20px_60px_-48px_rgba(28,25,23,0.5)] sm:p-8">
            <div className="flex items-end justify-between gap-4 border-b border-stone-200 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Appointment Cart
                </p>
                <h2 className="mt-2 text-2xl font-light">Selected pieces for review</h2>
              </div>
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-full border border-stone-200 px-4 py-2 text-xs uppercase tracking-[0.22em] text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-900"
                >
                  Clear Cart
                </button>
              ) : null}
            </div>

            {items.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-stone-100 text-stone-400">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <h3 className="mt-5 text-xl font-light">Your selection is empty</h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-stone-600">
                  Add jade pieces from the collection or continue with a consultation request using
                  the form beside this cart.
                </p>
                <Link
                  href="/products"
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-stone-900 px-5 py-2.5 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
                >
                  Explore Collection
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-stone-200">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="grid gap-5 py-6 md:grid-cols-[180px_1fr] md:items-center"
                  >
                    <Link
                      href={item.detailHref}
                      className="overflow-hidden rounded-[1.4rem] border border-stone-200 bg-stone-100"
                    >
                      <img
                        src={cartImages[item.id] || item.imageUrl || PLACEHOLDER_IMAGE}
                        alt={item.name}
                        className="aspect-square h-full w-full object-cover"
                        onError={(event) => {
                          const target = event.target as HTMLImageElement;
                          target.src = PLACEHOLDER_IMAGE;
                        }}
                      />
                    </Link>

                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={item.detailHref}
                            className="text-xl font-light transition-colors hover:text-emerald-700"
                          >
                            {item.name}
                          </Link>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.sku ? (
                              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-stone-600">
                                {item.sku}
                              </span>
                            ) : null}
                            {item.color ? (
                              <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-stone-500">
                                {item.color}
                              </span>
                            ) : null}
                            {item.tier ? (
                              <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-stone-500">
                                {item.tier.replace(/_/g, " ")}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-stone-500 transition-colors hover:border-rose-200 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>

                      <p className="text-sm leading-7 text-stone-600">
                        Added on {formatDate(item.addedAt)}. This item will be included in your
                        appointment review list.
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="xl:sticky xl:top-28">
            <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_24px_80px_-56px_rgba(28,25,23,0.55)]">
              <div className="border-b border-stone-200 bg-[linear-gradient(160deg,#0f172a_0%,#14532d_55%,#022c22_100%)] px-6 py-7 text-white sm:px-8">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100">
                  Appointment Request
                </p>
                <h2 className="mt-3 text-2xl font-light">Schedule your private consultation</h2>
                <p className="mt-3 text-sm leading-7 text-emerald-50/90">
                  {isCustomerSession
                    ? "Your account details and showroom assignment are already prepared. Confirm the time and send the request."
                    : "Choose a branch, set a time, and send the preferred contact details the team should use."}
                </p>
              </div>

              <div className="space-y-5 px-6 py-6 sm:px-8">
                {isBootstrapping ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading branches and customer details...
                  </div>
                ) : null}

                {isCustomerSession && branchSelectionNote ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                    {branchSelectionNote}
                  </div>
                ) : null}

                {isCustomerSession && missingLockedProfileFields.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    Your account is missing: {missingLockedProfileFields.join(", ")}. Update them in{" "}
                    <Link href="/profile" className="font-medium underline underline-offset-2">
                      Profile
                    </Link>{" "}
                    if you want the appointment request to include the full customer record.
                  </div>
                ) : null}

                {!isCustomerSession ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                    Sign in with a customer account to auto-fill your profile and review appointment
                    history on the separate Appointment page.
                    {!authUser ? (
                      <Link
                        href="/login?returnTo=/cart"
                        className="mt-3 inline-flex items-center gap-2 font-medium text-emerald-800 hover:text-emerald-900"
                      >
                        Login to continue
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  {isCustomerSession ? (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                        Assigned Showroom
                      </span>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                        {selectedBranch ? branchLabel(selectedBranch) : "Assigning showroom..."}
                      </div>
                    </div>
                  ) : (
                    <label className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Branch</span>
                      <select
                        value={form.branchId}
                        onChange={(event) => updateForm("branchId", event.target.value)}
                        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-500"
                      >
                        <option value="">Select a branch</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branchLabel(branch)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Appointment Time</span>
                    <input
                      type="datetime-local"
                      min={minAppointmentValue}
                      value={form.appointmentDate}
                      onChange={(event) => updateForm("appointmentDate", event.target.value)}
                      className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-500"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Full Name</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      placeholder="Your full name"
                      readOnly={isCustomerSession}
                      className={`w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-500 ${
                        isCustomerSession ? "bg-stone-50 text-stone-500" : ""
                      }`}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Email Address</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => updateForm("email", event.target.value)}
                      placeholder="name@example.com"
                      readOnly={isCustomerSession}
                      className={`w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-500 ${
                        isCustomerSession ? "bg-stone-50 text-stone-500" : ""
                      }`}
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Phone</span>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(event) => updateForm("phone", event.target.value)}
                      placeholder="+66..."
                      readOnly={isCustomerSession}
                      className={`w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-500 ${
                        isCustomerSession ? "bg-stone-50 text-stone-500" : ""
                      }`}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">LINE ID</span>
                    <input
                      type="text"
                      value={form.lineId}
                      onChange={(event) => updateForm("lineId", event.target.value)}
                      placeholder="@jadeclient"
                      readOnly={isCustomerSession}
                      className={`w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-500 ${
                        isCustomerSession ? "bg-stone-50 text-stone-500" : ""
                      }`}
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Language</span>
                    <select
                      value={form.language}
                      onChange={(event) => updateForm("language", event.target.value)}
                      disabled={isCustomerSession}
                      className={`w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-500 ${
                        isCustomerSession ? "bg-stone-50 text-stone-500" : ""
                      }`}
                    >
                      <option value="English">English</option>
                      <option value="Chinese">Chinese</option>
                      <option value="Thai">Thai</option>
                      <option value="Myanmar">Myanmar</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">City</span>
                    <input
                      type="text"
                      value={form.userEnteredCity}
                      onChange={(event) => updateForm("userEnteredCity", event.target.value)}
                      placeholder="Bangkok"
                      readOnly={isCustomerSession}
                      className={`w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition-colors focus:border-emerald-500 ${
                        isCustomerSession ? "bg-stone-50 text-stone-500" : ""
                      }`}
                    />
                  </label>
                </div>

                {isCustomerSession ? (
                  <p className="text-xs leading-6 text-stone-500">
                    Your full name, email, phone, LINE ID, language, and city are locked from the
                    customer account profile. Only the appointment time is required here.
                  </p>
                ) : null}

                <div className="space-y-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                    Preferred Contact Method
                  </span>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["EMAIL", "PHONE", "LINE"] as const).map((channel) => (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => updateForm("preferredContact", channel)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                          form.preferredContact === channel
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
                        }`}
                      >
                        {channel}
                      </button>
                    ))}
                  </div>
                  {form.preferredContact === "LINE" ? (
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                      {preferredContactBlockingMessage ? (
                        <div className="space-y-3">
                          <p>{preferredContactBlockingMessage}</p>
                          {!isCustomerSession && !authUser ? (
                            <Link
                              href="/login?returnTo=/cart"
                              className="inline-flex items-center gap-2 font-medium text-emerald-800 hover:text-emerald-900"
                            >
                              Login as Customer
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          ) : null}
                          {isCustomerSession ? (
                            <button
                              type="button"
                              onClick={() => void handleConnectLine()}
                              disabled={isConnectingLine}
                              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isConnectingLine ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : null}
                              {isConnectingLine ? "Connecting..." : "Connect LINE"}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <p>
                          Connected LINE account verified
                          {customerLineVerifiedAt
                            ? ` on ${new Date(customerLineVerifiedAt).toLocaleString()}.`
                            : "."}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {form.preferredContact !== "LINE" && preferredContactBlockingMessage ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                      {preferredContactBlockingMessage}
                    </div>
                  ) : null}
                </div>

                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    rows={4}
                    placeholder="Tell us what you want the concierge to prepare."
                    className="w-full rounded-[1.5rem] border border-stone-200 px-4 py-3 text-sm leading-6 outline-none transition-colors focus:border-emerald-500"
                  />
                </label>

                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                  <p className="font-medium text-stone-900">
                    {count > 0 ? `${count} selected piece${count === 1 ? "" : "s"}` : "Private consultation request"}
                  </p>
                  {skuList.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {skuList.map((sku) => (
                        <span
                          key={sku}
                          className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-stone-600"
                        >
                          {sku}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 leading-6">
                      You can submit without selected items and let the team help shape the visit.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={
                    isSubmitting || isBootstrapping || isResolvingBranch || !canSubmitAppointment
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[1.5rem] bg-emerald-700 px-5 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {isSubmitting
                    ? "Submitting Request..."
                    : count > 0
                      ? `Reserve ${count} Piece${count === 1 ? "" : "s"}`
                      : "Request Consultation"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="px-6 pb-24 sm:px-12 lg:px-20">
        <div className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_-56px_rgba(28,25,23,0.55)] sm:p-8">
          <div className="flex flex-col gap-3 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                Appointment
              </p>
              <h2 className="mt-2 text-2xl font-light">
                Track request history on its own page
              </h2>
            </div>
            <Link
              href={isCustomerSession ? "/appointment" : "/login?returnTo=/appointment"}
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              {isCustomerSession ? "Open Appointment" : "Login to View Appointment"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-6 text-sm leading-7 text-stone-600">
            Review confirmations, requested pieces, and branch updates from the dedicated
            Appointment page instead of mixing history into the cart.
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <section className="px-6 py-24 sm:px-12 lg:px-20">
          <div className="rounded-[2rem] border border-stone-200 bg-white px-6 py-10 text-sm text-stone-500 shadow-[0_28px_90px_-60px_rgba(28,25,23,0.55)]">
            Loading cart...
          </div>
        </section>
      }
    >
      <CartPageContent />
    </Suspense>
  );
}
