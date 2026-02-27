"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import {
  getAdminLogHistory,
  type AdminLogHistoryItem,
  type LogHistoryType,
} from "@/lib/apiClient";

const HISTORY_TYPE_OPTIONS: Array<{ value: LogHistoryType; label: string }> = [
  { value: "all", label: "All" },
  { value: "internal", label: "Internal" },
  { value: "audit", label: "Audit" },
  { value: "product", label: "Product" },
  { value: "other", label: "Other" },
];

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message;
  }

  return "Unexpected error.";
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const asNullableString = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
};

const asNonNegativeInt = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
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

const formatBytes = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getSnapshotRecordCount = (item: AdminLogHistoryItem) => {
  const data = asRecord(item.data);
  if (!data) {
    return null;
  }

  const totalRecords = asNonNegativeInt(data.totalRecords);
  if (totalRecords !== null) {
    return totalRecords;
  }

  if (Array.isArray(data.records)) {
    return data.records.length;
  }

  return null;
};

const getSnapshotSummary = (item: AdminLogHistoryItem) => {
  if (item.parseError) {
    return `Parse error: ${item.parseError}`;
  }

  const data = asRecord(item.data);
  if (!data) {
    return "No snapshot payload.";
  }

  const backupType = asNullableString(data.backupType);
  const reason = asNullableString(data.reason);
  const requestedByUserId = asNullableString(data.requestedByUserId);

  const parts = [
    backupType ? `type: ${backupType}` : "",
    reason ? `reason: ${reason}` : "",
    requestedByUserId ? `requestedBy: ${requestedByUserId}` : "",
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" | ");
  }

  return "Snapshot loaded.";
};

/* ────────────── icons ────────────── */
function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );
}
function TableRowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A2 2 0 003.38 22h17.24a2 2 0 001.7-3.28l-8.6-14.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}
function GaugeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function EmptyBoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function categoryBadge(category: string | null) {
  switch (category?.toLowerCase()) {
    case "audit":
      return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300";
    case "internal":
      return "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300";
    case "product":
      return "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300";
  }
}

export default function AdminLogHistoryPage() {
  const [rows, setRows] = useState<AdminLogHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);
  const [expandedFileName, setExpandedFileName] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const [draftType, setDraftType] = useState<LogHistoryType>("all");
  const [draftLimit, setDraftLimit] = useState(String(DEFAULT_LIMIT));
  const [appliedType, setAppliedType] = useState<LogHistoryType>("all");
  const [appliedLimit, setAppliedLimit] = useState(DEFAULT_LIMIT);

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

  const loadLogHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminLogHistory({
        accessToken,
        type: appliedType,
        limit: appliedLimit,
      });

      setRows(response.items);
      setCount(response.count);
    } catch (caughtError) {
      setRows([]);
      setCount(0);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [appliedLimit, appliedType, getAccessToken]);

  useEffect(() => {
    void loadLogHistory();
  }, [loadLogHistory]);

  const parseErrorsCount = useMemo(
    () => rows.filter((row) => Boolean(row.parseError)).length,
    [rows],
  );

  const onApplyFilters = () => {
    const parsedLimit = Number(draftLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      setError("Limit must be a positive integer.");
      return;
    }

    const normalizedLimit = Math.min(parsedLimit, MAX_LIMIT);
    setError("");
    setAppliedType(draftType);
    setAppliedLimit(normalizedLimit);
    setDraftLimit(String(normalizedLimit));
    setExpandedFileName("");
  };

  const onResetFilters = () => {
    setError("");
    setDraftType("all");
    setDraftLimit(String(DEFAULT_LIMIT));
    setAppliedType("all");
    setAppliedLimit(DEFAULT_LIMIT);
    setExpandedFileName("");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Log History"
        description="Read historical deleted-log JSON snapshots from backup files."
      />

      {/* ───── stat cards ───── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 px-4 py-3 flex items-start gap-3">
          <div className="shrink-0 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
            <ArchiveIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Snapshots</p>
            {loading ? (
              <div className="mt-1.5 h-6 w-12 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ) : (
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{count.toLocaleString()}</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 px-4 py-3 flex items-start gap-3">
          <div className="shrink-0 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            <TableRowsIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Loaded Rows</p>
            {loading ? (
              <div className="mt-1.5 h-6 w-12 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ) : (
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{rows.length}</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 px-4 py-3 flex items-start gap-3">
          <div className="shrink-0 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            <AlertTriangleIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Parse Errors</p>
            {loading ? (
              <div className="mt-1.5 h-6 w-12 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ) : (
              <p className={`text-2xl font-semibold mt-0.5 ${parseErrorsCount > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
                {parseErrorsCount}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 px-4 py-3 flex items-start gap-3">
          <div className="shrink-0 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
            <GaugeIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Limit</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{appliedLimit}</p>
          </div>
        </div>
      </div>

      {/* ───── collapsible filters ───── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filters</span>
          <svg
            className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${showFilters ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showFilters && (
          <div className="px-5 pb-4 pt-0 space-y-4 border-t border-gray-100 dark:border-gray-700/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Type
                </label>
                <select
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as LogHistoryType)}
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                >
                  {HISTORY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={MAX_LIMIT}
                  value={draftLimit}
                  onChange={(e) => setDraftLimit(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onApplyFilters}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={onResetFilters}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* error alert */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20">
          <AlertTriangleIcon className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadLogHistory()}
            className="ml-auto shrink-0 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ───── snapshot files table / cards ───── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/60 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Snapshot Files</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{loading ? "..." : `${rows.length} row(s)`}</p>
        </div>

        {/* loading skeleton */}
        {loading && (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  <div className="h-3 w-32 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
                <div className="hidden sm:flex items-center gap-4">
                  <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  <div className="h-5 w-12 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* empty state */}
        {!loading && !error && rows.length === 0 && (
          <div className="px-5 py-16 flex flex-col items-center gap-3">
            <EmptyBoxIcon className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No log history snapshots found.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Adjust filters or try a different type.</p>
          </div>
        )}

        {/* desktop table */}
        {!loading && rows.length > 0 && (
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700/60">
                  <th className="px-5 py-3 font-medium">Snapshot</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3 font-medium">Size</th>
                  <th className="px-5 py-3 font-medium">Records</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Summary</th>
                  <th className="px-5 py-3 font-medium text-right">JSON</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const isExpanded = expandedFileName === item.fileName;
                  const recordCount = getSnapshotRecordCount(item);

                  return (
                    <Fragment key={item.fileName}>
                      <tr className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-[220px]">{item.fileName}</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[220px]">{item.relativePath || "-"}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${categoryBadge(item.category)}`}>
                            {item.category || "other"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDateTime(item.updatedAt)}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatBytes(item.sizeBytes)}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{recordCount ?? "-"}</td>
                        <td className="px-5 py-3">
                          {item.parseError ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                              <AlertTriangleIcon className="w-3 h-3" />
                              Error
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300 max-w-[280px]">
                          <p className="break-words text-xs">{getSnapshotSummary(item)}</p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedFileName((prev) => (prev === item.fileName ? "" : item.fileName))}
                            className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-b border-gray-100 dark:border-gray-700/40 bg-gray-50/40">
                          <td colSpan={8} className="px-5 py-4">
                            <pre className="text-xs leading-5 whitespace-pre-wrap break-words bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 rounded-lg p-4 text-gray-700 dark:text-gray-300 overflow-x-auto max-h-96 overflow-y-auto">
                              {JSON.stringify(item.data ?? { parseError: item.parseError || "No snapshot payload" }, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* mobile / tablet card view */}
        {!loading && rows.length > 0 && (
          <div className="lg:hidden divide-y divide-gray-100">
            {rows.map((item) => {
              const isExpanded = expandedFileName === item.fileName;
              const recordCount = getSnapshotRecordCount(item);

              return (
                <div key={item.fileName} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-gray-800 dark:text-gray-200 truncate">{item.fileName}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{item.relativePath || "-"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.parseError ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          <AlertTriangleIcon className="w-3 h-3" />
                          Error
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                          OK
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${categoryBadge(item.category)}`}>
                      {item.category || "other"}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">|</span>
                    <span className="text-gray-500 dark:text-gray-400">{formatBytes(item.sizeBytes)}</span>
                    {recordCount !== null && (
                      <>
                        <span className="text-gray-400 dark:text-gray-500">|</span>
                        <span className="text-gray-500 dark:text-gray-400">{recordCount} records</span>
                      </>
                    )}
                    <span className="text-gray-400 dark:text-gray-500">|</span>
                    <span className="text-gray-500 dark:text-gray-400">{formatDateTime(item.updatedAt)}</span>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 break-words">{getSnapshotSummary(item)}</p>

                  <button
                    type="button"
                    onClick={() => setExpandedFileName((prev) => (prev === item.fileName ? "" : item.fileName))}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {isExpanded ? "Hide JSON" : "View JSON"}
                  </button>

                  {isExpanded && (
                    <pre className="text-xs leading-5 whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg p-3 text-gray-700 dark:text-gray-300 overflow-x-auto max-h-80 overflow-y-auto">
                      {JSON.stringify(item.data ?? { parseError: item.parseError || "No snapshot payload" }, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
