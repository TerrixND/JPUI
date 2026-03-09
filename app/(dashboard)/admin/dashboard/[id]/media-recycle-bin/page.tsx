"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import {
  getAdminDeletedMedia,
  permanentlyDeleteAdminMedia,
  restoreAdminDeletedMedia,
  type AdminDeletedMediaItem,
} from "@/lib/apiClient";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  return "Unexpected error.";
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatBytes = (bytes: number | null) => {
  if (bytes === null || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export default function AdminMediaRecycleBinPage() {
  const [rows, setRows] = useState<AdminDeletedMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [retentionDays, setRetentionDays] = useState<number | null>(10);
  const [purgeInfo, setPurgeInfo] = useState<{
    scannedCount: number | null;
    purgedCount: number | null;
    failedCount: number | null;
  } | null>(null);
  const [busyActionMediaId, setBusyActionMediaId] = useState<string | null>(null);

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

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminDeletedMedia({
        accessToken,
        page,
        limit,
        search: searchApplied || undefined,
      });

      setRows(response.items);
      setTotal(response.total);
      setTotalPages(Math.max(1, response.totalPages));
      setRetentionDays(response.retentionDays);
      setPurgeInfo(response.purge);
    } catch (caughtError) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, limit, page, searchApplied]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (page <= totalPages) {
      return;
    }

    setPage(totalPages);
  }, [page, totalPages]);

  const onApplySearch = () => {
    setInfo("");
    setPage(1);
    setSearchApplied(searchDraft.trim());
  };

  const onResetSearch = () => {
    setInfo("");
    setSearchDraft("");
    setSearchApplied("");
    setPage(1);
  };

  const onRestore = async (row: AdminDeletedMediaItem) => {
    if (!row.canRestore) {
      setError("This media cannot be restored because the original product is no longer available.");
      return;
    }

    setBusyActionMediaId(row.id);
    setError("");
    setInfo("");
    try {
      const accessToken = await getAccessToken();
      await restoreAdminDeletedMedia({
        accessToken,
        mediaId: row.id,
      });
      setInfo("Media restored successfully.");
      await loadRows();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setBusyActionMediaId(null);
    }
  };

  const onPermanentDelete = async (row: AdminDeletedMediaItem) => {
    const confirmed = window.confirm(
      "Permanently delete this media from storage and database? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    setBusyActionMediaId(row.id);
    setError("");
    setInfo("");
    try {
      const accessToken = await getAccessToken();
      await permanentlyDeleteAdminMedia({
        accessToken,
        mediaId: row.id,
      });
      setInfo("Media permanently deleted.");
      await loadRows();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setBusyActionMediaId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recently Deleted Media"
        description="Soft-deleted media remains here before permanent deletion from DB and R2."
      />

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
              <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Retention Period</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{retentionDays ?? 10} days</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/30">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Auto Purge Stats</p>
              {purgeInfo ? (
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{purgeInfo.scannedCount ?? 0} scanned</span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">{purgeInfo.purgedCount ?? 0} purged</span>
                  {(purgeInfo.failedCount ?? 0) > 0 && (
                    <span className="text-sm text-red-600 dark:text-red-400">{purgeInfo.failedCount} failed</span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">No data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <input
              type="text"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onApplySearch();
              }}
              placeholder="Search media id, URL, MIME, product id..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApplySearch}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={onResetSearch}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      ) : null}

      {/* Info Alert */}
      {info ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-emerald-500 dark:text-emerald-400 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-sm text-emerald-700 dark:text-emerald-200">{info}</p>
        </div>
      ) : null}

      {/* Data Section */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/80 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden">

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600 dark:border-gray-700 dark:border-t-emerald-400" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading deleted media...</p>
          </div>
        ) : rows.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700/50">
              <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">No deleted media found</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {searchApplied ? "Try adjusting your search terms." : "Deleted media will appear here."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
              {rows.map((row) => (
                <div key={row.id} className="p-4 space-y-3">
                  {/* Media Info Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{row.id}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {row.type && (
                          <span className="inline-flex items-center rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                            {row.type}
                          </span>
                        )}
                        {row.mimeType && (
                          <span className="inline-flex items-center rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                            {row.mimeType}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatBytes(row.sizeBytes)}
                        </span>
                      </div>
                    </div>
                    {row.url && (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Preview
                      </a>
                    )}
                  </div>

                  {/* Original Product */}
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Original Product</p>
                    {row.originalProduct ? (
                      <>
                        <p className="text-sm text-gray-900 dark:text-gray-100">{row.originalProduct.name || "-"}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {row.originalProduct.id}
                          {row.originalProduct.sku ? ` | ${row.originalProduct.sku}` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Original product unavailable</p>
                    )}
                  </div>

                  {/* Dates Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Deleted At</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{formatDateTime(row.deletedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Purge At</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{formatDateTime(row.purgeAfterAt)}</p>
                    </div>
                  </div>

                  {/* Days Remaining */}
                  {row.remainingDays !== null && (
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        row.remainingDays <= 2
                          ? "bg-red-500"
                          : row.remainingDays <= 5
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`} />
                      <span className={`text-xs font-medium ${
                        row.remainingDays <= 2
                          ? "text-red-600 dark:text-red-400"
                          : row.remainingDays <= 5
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {row.remainingDays} {row.remainingDays === 1 ? "day" : "days"} remaining
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        void onRestore(row);
                      }}
                      disabled={busyActionMediaId === row.id || !row.canRestore}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busyActionMediaId === row.id ? "Processing..." : "Restore"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void onPermanentDelete(row);
                      }}
                      disabled={busyActionMediaId === row.id}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busyActionMediaId === row.id ? "Processing..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 dark:border-gray-700/50">
                    <th className="px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Media</th>
                    <th className="px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Original Product</th>
                    <th className="px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Deleted At</th>
                    <th className="px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Purge At</th>
                    <th className="px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{row.id}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {row.type || "-"} | {row.mimeType || "-"} | {formatBytes(row.sizeBytes)}
                        </p>
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Preview
                          </a>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        {row.originalProduct ? (
                          <div>
                            <p className="text-gray-900 dark:text-gray-100">{row.originalProduct.name || "-"}</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {row.originalProduct.id}
                              {row.originalProduct.sku ? ` | ${row.originalProduct.sku}` : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Original product unavailable
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{formatDateTime(row.deletedAt)}</td>
                      <td className="px-5 py-4">
                        <p className="text-gray-600 dark:text-gray-300">{formatDateTime(row.purgeAfterAt)}</p>
                        {row.remainingDays !== null && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <div className={`h-1.5 w-1.5 rounded-full ${
                              row.remainingDays <= 2
                                ? "bg-red-500"
                                : row.remainingDays <= 5
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`} />
                            <span className={`text-xs ${
                              row.remainingDays <= 2
                                ? "text-red-600 dark:text-red-400"
                                : row.remainingDays <= 5
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-gray-500 dark:text-gray-400"
                            }`}>
                              {row.remainingDays} {row.remainingDays === 1 ? "day" : "days"} left
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void onRestore(row);
                            }}
                            disabled={busyActionMediaId === row.id || !row.canRestore}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {busyActionMediaId === row.id ? "..." : "Restore"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void onPermanentDelete(row);
                            }}
                            disabled={busyActionMediaId === row.id}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {busyActionMediaId === row.id ? "..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination Bar */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200/80 dark:border-gray-700/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * limit + (rows.length ? 1 : 0)}-
              {(page - 1) * limit + rows.length} of {total}
            </p>

            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(event) => {
                  setPage(1);
                  setLimit(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                }}
                className="px-2 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-gray-700 dark:text-gray-300"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}/page
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
