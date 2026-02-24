"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import {
  clearAdminInternalErrorLogs,
  getAdminInternalErrorLogs,
  type AdminInternalErrorLogRow,
} from "@/lib/apiClient";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type Filters = {
  message: string;
  actorUserId: string;
  source: string;
  process: string;
  functionName: string;
  requestId: string;
  colorCode: string;
  from: string;
  to: string;
};

const initialFilters: Filters = {
  message: "",
  actorUserId: "",
  source: "",
  process: "",
  functionName: "",
  requestId: "",
  colorCode: "",
  from: "",
  to: "",
};

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

const formatRelativeTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function AdminErrors() {
  const [rows, setRows] = useState<AdminInternalErrorLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [clearReason, setClearReason] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [clearMessage, setClearMessage] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dangerOpen, setDangerOpen] = useState(false);

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

  const loadInternalErrors = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminInternalErrorLogs({
        accessToken,
        page,
        limit,
        message: appliedFilters.message.trim() || undefined,
        actorUserId: appliedFilters.actorUserId.trim() || undefined,
        source: appliedFilters.source.trim() || undefined,
        process: appliedFilters.process.trim() || undefined,
        functionName: appliedFilters.functionName.trim() || undefined,
        requestId: appliedFilters.requestId.trim() || undefined,
        colorCode: appliedFilters.colorCode.trim() || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
      });

      setRows(response.items);
      setTotal(response.total);
      setTotalPages(Math.max(1, response.totalPages));
    } catch (caughtError) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, getAccessToken, limit, page]);

  useEffect(() => {
    void loadInternalErrors();
  }, [loadInternalErrors]);

  useEffect(() => {
    if (page <= totalPages) {
      return;
    }

    setPage(totalPages);
  }, [page, totalPages]);

  const onApplyFilters = () => {
    setPage(1);
    setAppliedFilters(draftFilters);
  };

  const onResetFilters = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const onClearInternalErrorLogs = async () => {
    setClearError("");
    setClearMessage("");

    if (!clearReason.trim()) {
      setClearError("Reason is required.");
      return;
    }

    setClearing(true);

    try {
      const accessToken = await getAccessToken();
      const result = await clearAdminInternalErrorLogs(clearReason.trim(), {
        accessToken,
      });

      const parts = [
        result.deletedCount !== null ? `deleted: ${result.deletedCount}` : "",
        result.backupFileName ? `backup: ${result.backupFileName}` : "",
        result.backupRecordCount !== null ? `records: ${result.backupRecordCount}` : "",
      ].filter(Boolean);

      setClearMessage(parts.length ? `${result.message} (${parts.join(", ")})` : result.message);
      setClearReason("");

      await loadInternalErrors();
    } catch (caughtError) {
      setClearError(getErrorMessage(caughtError));
    } finally {
      setClearing(false);
    }
  };

  const activeFilterCount = Object.values(appliedFilters).filter((v) => v.trim()).length;
  const currentPageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const currentPageEnd = Math.min(total, page * limit);
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const inputClass =
    "w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors placeholder:text-gray-400";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Errors"
        description="Inspect internal error logs and clear them with backup creation."
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Total Errors</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{loading ? "-" : total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Current Page</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{loading ? "-" : rows.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Active Filters</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{activeFilterCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Per Page</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{limit}</p>
        </div>
      </div>

      {/* Filters panel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-700 rounded-full">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {filtersOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Message contains</label>
                <input
                  type="text"
                  value={draftFilters.message}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Search error messages..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Actor User ID</label>
                <input
                  type="text"
                  value={draftFilters.actorUserId}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, actorUserId: e.target.value }))}
                  placeholder="e.g. abc-123..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Source</label>
                <input
                  type="text"
                  value={draftFilters.source}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, source: e.target.value }))}
                  placeholder="e.g. api, worker..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Process</label>
                <input
                  type="text"
                  value={draftFilters.process}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, process: e.target.value }))}
                  placeholder="Process name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Function</label>
                <input
                  type="text"
                  value={draftFilters.functionName}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, functionName: e.target.value }))}
                  placeholder="Function name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Request ID</label>
                <input
                  type="text"
                  value={draftFilters.requestId}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, requestId: e.target.value }))}
                  placeholder="Request ID"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Color Code</label>
                <input
                  type="text"
                  value={draftFilters.colorCode}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, colorCode: e.target.value }))}
                  placeholder="#FF0000"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">From Date</label>
                <input
                  type="date"
                  value={draftFilters.from}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, from: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">To Date</label>
                <input
                  type="date"
                  value={draftFilters.to}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, to: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onApplyFilters}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Reset
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Rows</label>
                <select
                  value={limit}
                  onChange={(e) => {
                    setPage(1);
                    setLimit(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                  }}
                  className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error logs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-gray-900">Internal Error Logs</h2>
            {!loading && total > 0 && (
              <span className="px-2.5 py-0.5 text-[11px] font-medium bg-red-100 text-red-700 rounded-full">
                {total.toLocaleString()} total
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {loading ? "Loading..." : `${currentPageStart}\u2013${currentPageEnd} of ${total}`}
          </p>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center">
            <svg className="w-10 h-10 text-red-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void loadInternalErrors()}
              className="mt-3 px-4 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-500 font-medium">No error logs found</p>
            <p className="text-xs text-gray-400 mt-1">All clear — no internal errors to display.</p>
          </div>
        ) : (
          <>
            {/* Desktop table (lg+) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider bg-gray-50/80 border-b border-gray-200">
                    <th className="px-5 py-3 font-medium">Time</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium">Process / Function</th>
                    <th className="px-5 py-3 font-medium">Message</th>
                    <th className="px-5 py-3 font-medium">Actor</th>
                    <th className="px-5 py-3 font-medium">Request</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap align-top">
                        <p className="text-xs">{formatDateTime(row.createdAt)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(row.createdAt)}</p>
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className="flex items-center gap-2">
                          {row.colorCode && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                              style={{ backgroundColor: row.colorCode }}
                            />
                          )}
                          <div>
                            <p className="text-gray-700 font-medium text-xs">{row.source || "-"}</p>
                            {row.colorCode && (
                              <p className="text-[10px] text-gray-400 font-mono">{row.colorCode}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-700 align-top">
                        <p className="text-xs">{row.process || "-"}</p>
                        {row.functionName && (
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">{row.functionName}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600 max-w-md align-top">
                        <p className={`text-xs break-words ${expandedRow === row.id ? "" : "line-clamp-2"}`}>
                          {row.message || "-"}
                        </p>
                        {expandedRow === row.id && row.stack && (
                          <pre className="text-[10px] text-gray-400 mt-2 p-2.5 bg-gray-50 rounded-lg overflow-x-auto whitespace-pre-wrap break-words font-mono leading-relaxed max-h-48 overflow-y-auto">
                            {row.stack}
                          </pre>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <p className="font-mono text-[11px] text-gray-700 truncate max-w-[120px]">{row.actorUserId || "-"}</p>
                        {row.actorEmail && (
                          <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{row.actorEmail}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <p className="font-mono text-[11px] text-gray-700 truncate max-w-[120px]">{row.requestId || "-"}</p>
                        {row.ipAddress && (
                          <p className="text-[10px] text-gray-400">{row.ipAddress}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet card view (<lg) */}
            <div className="lg:hidden divide-y divide-gray-100">
              {rows.map((row) => {
                const isExpanded = expandedRow === row.id;
                return (
                  <div
                    key={row.id}
                    className="px-4 py-3.5 hover:bg-gray-50/50 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                      className="w-full text-left"
                    >
                      {/* Top row: color dot + source + time */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                            style={{ backgroundColor: row.colorCode || "#94a3b8" }}
                          />
                          <span className="text-xs font-medium text-gray-800 truncate">
                            {row.source || "Unknown"}
                          </span>
                          {row.process && (
                            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-md truncate max-w-[120px]">
                              {row.process}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-gray-400">{formatRelativeTime(row.createdAt)}</span>
                          <svg
                            className={`w-3.5 h-3.5 text-gray-300 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Message preview */}
                      <p className={`text-xs text-gray-600 mt-1.5 ${isExpanded ? "" : "line-clamp-2"} break-words`}>
                        {row.message || "No message"}
                      </p>

                      {row.functionName && (
                        <p className="text-[10px] text-gray-400 font-mono mt-1">{row.functionName}</p>
                      )}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2.5 pl-4 border-l-2 border-gray-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Time</p>
                            <p className="text-xs text-gray-600 mt-0.5">{formatDateTime(row.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Source</p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {row.source || "-"}
                              {row.colorCode && <span className="text-gray-400 ml-1 font-mono text-[10px]">{row.colorCode}</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Process</p>
                            <p className="text-xs text-gray-600 mt-0.5">{row.process || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Function</p>
                            <p className="text-xs text-gray-600 font-mono mt-0.5">{row.functionName || "-"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Actor</p>
                            <p className="text-xs text-gray-600 font-mono mt-0.5 break-all">{row.actorUserId || "-"}</p>
                            {row.actorEmail && <p className="text-[10px] text-gray-400">{row.actorEmail}</p>}
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Request</p>
                            <p className="text-xs text-gray-600 font-mono mt-0.5 break-all">{row.requestId || "-"}</p>
                            {row.ipAddress && <p className="text-[10px] text-gray-400">{row.ipAddress}</p>}
                          </div>
                        </div>

                        {row.stack && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Stack Trace</p>
                            <pre className="text-[10px] text-gray-500 p-2.5 bg-gray-50 rounded-lg overflow-x-auto whitespace-pre-wrap break-words font-mono leading-relaxed max-h-48 overflow-y-auto">
                              {row.stack}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && !error && rows.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 hidden sm:block">
              Showing {currentPageStart}&ndash;{currentPageEnd} of {total.toLocaleString()} errors
            </p>
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={!canGoPrev}
                className="px-2 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={!canGoPrev}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-emerald-50 rounded-md min-w-[60px] text-center">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={!canGoNext}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={!canGoNext}
                className="px-2 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setDangerOpen((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-red-50/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-medium text-red-700">Danger Zone</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dangerOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {dangerOpen && (
          <div className="px-5 pb-5 border-t border-red-100">
            <div className="mt-4 bg-red-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-red-800">Clear Internal Error Logs</p>
              <p className="text-xs text-red-600/80">
                This action is irreversible. A backup file will be generated before deletion.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={clearReason}
                  onChange={(e) => setClearReason(e.target.value)}
                  placeholder="Reason for clearing logs"
                  className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-red-200 rounded-lg outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-colors placeholder:text-red-300"
                />
                <button
                  type="button"
                  onClick={() => void onClearInternalErrorLogs()}
                  disabled={clearing}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {clearing ? "Clearing..." : "Clear All Logs"}
                </button>
              </div>
              {clearError && (
                <div className="flex items-center gap-2 p-2.5 bg-red-100 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p className="text-xs text-red-700">{clearError}</p>
                </div>
              )}
              {clearMessage && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <p className="text-xs text-emerald-700">{clearMessage}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
