"use client";

import GoogleLocationMap from "@/components/ui/location/GoogleLocationMap";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import {
  getAdminStaffMap,
  handleAccountAccessDeniedError,
  type AdminStaffMapLocationRecord,
} from "@/lib/apiClient";
import { normalizeExactLocationRecord } from "@/lib/googleMaps";
import supabase from "@/lib/supabase";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const getErrorMessage = (value: unknown, fallback: string) => {
  if (value instanceof Error) {
    return value.message;
  }

  return fallback;
};

export default function AdminStaffMapPage() {
  const { canViewStaffMap, dashboardBasePath } = useRole();
  const [items, setItems] = useState<AdminStaffMapLocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const accessToken = session?.access_token || "";
    if (!accessToken) {
      throw new Error("Missing access token. Please sign in again.");
    }

    return accessToken;
  }, []);

  const loadMap = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminStaffMap({ accessToken });
      setItems(response.items);
    } catch (caughtError) {
      if (handleAccountAccessDeniedError(caughtError)) {
        return;
      }

      setItems([]);
      setError(getErrorMessage(caughtError, "Failed to load the staff map."));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!canViewStaffMap) {
      setLoading(false);
      return;
    }

    void loadMap();
  }, [canViewStaffMap, loadMap]);

  const markers = useMemo(
    () =>
      items
        .map((item) => {
          const location = normalizeExactLocationRecord(item.exactGeoLocation);
          if (!location || location.latitude === null || location.longitude === null) {
            return null;
          }

          return {
            id: item.id,
            title: item.displayName || item.email || item.id,
            subtitle: [item.role, item.branchName, location.label].filter(Boolean).join(" / "),
            location,
          };
        })
        .filter(
          (
            marker,
          ): marker is {
            id: string;
            title: string;
            subtitle: string;
            location: NonNullable<ReturnType<typeof normalizeExactLocationRecord>>;
          } => Boolean(marker),
        ),
    [items],
  );

  if (!canViewStaffMap) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Staff Map"
          description="This admin account does not have permission to open the internal staff map."
          action={
            <Link
              href={dashboardBasePath}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back to Dashboard
            </Link>
          }
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
          Enable the `Staff Map` capability on this admin account or use the main admin account.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Map"
        description="Main-admin internal map of exact staff locations. Main admin is excluded from the plotted records."
        action={
          <Link
            href={dashboardBasePath}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Back to Dashboard
          </Link>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Live Staff Coverage
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Showing {markers.length} staff location{markers.length === 1 ? "" : "s"} with
                precise coordinates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadMap()}
              className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700/60 dark:bg-gray-800/40 dark:text-gray-300"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="h-[480px] animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40" />
          ) : (
            <GoogleLocationMap markers={markers} className="min-h-[480px]" />
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Staff Directory
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Each card shows the stored branch, coarse location, and timezone snapshot.
            </p>
          </div>

          <div className="space-y-3">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700/60 dark:bg-gray-800/40"
                  />
                ))
              : items.map((item) => {
                  const location = normalizeExactLocationRecord(item.exactGeoLocation);
                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700/60 dark:bg-gray-800/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {item.displayName || item.email || item.id}
                          </p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {[item.role, item.branchName].filter(Boolean).join(" / ") || "-"}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:bg-gray-900 dark:text-gray-300">
                          {item.status || "ACTIVE"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        <p>{location?.label || [item.city, item.country].filter(Boolean).join(", ") || "-"}</p>
                        <p>{location?.timezone || item.timezone || "-"}</p>
                      </div>
                    </article>
                  );
                })}
          </div>
        </section>
      </div>
    </div>
  );
}

