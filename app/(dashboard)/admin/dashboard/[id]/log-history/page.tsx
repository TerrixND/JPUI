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

export default function AdminLogHistoryPage() {
  const [rows, setRows] = useState<AdminLogHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);
  const [expandedFileName, setExpandedFileName] = useState("");

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Snapshots</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{loading ? "-" : count.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Loaded Rows</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{loading ? "-" : rows.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Parse Errors</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{loading ? "-" : parseErrorsCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Limit</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{appliedLimit}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Type
            </label>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as LogHistoryType)}
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              {HISTORY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Limit
            </label>
            <input
              type="number"
              min={1}
              max={MAX_LIMIT}
              value={draftLimit}
              onChange={(e) => setDraftLimit(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
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
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Snapshot Files</h2>
          <p className="text-xs text-gray-500">{rows.length} row(s)</p>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-500">Loading log history snapshots...</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-500">No log history snapshots found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
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
                      <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-mono text-xs text-gray-700">{item.fileName}</p>
                          <p className="text-[11px] text-gray-500">{item.relativePath || "-"}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-700">{item.category || "-"}</td>
                        <td className="px-5 py-3 text-gray-500">{formatDateTime(item.updatedAt)}</td>
                        <td className="px-5 py-3 text-gray-500">{formatBytes(item.sizeBytes)}</td>
                        <td className="px-5 py-3 text-gray-700">{recordCount ?? "-"}</td>
                        <td className="px-5 py-3">
                          {item.parseError ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">
                              Parse Error
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-600 max-w-md">
                          <p className="break-words">{getSnapshotSummary(item)}</p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedFileName((prev) => (prev === item.fileName ? "" : item.fileName))}
                            className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-b border-gray-100 bg-gray-50/40">
                          <td colSpan={8} className="px-5 py-4">
                            <pre className="text-xs leading-5 whitespace-pre-wrap break-words bg-white border border-gray-200 rounded-lg p-3 text-gray-700 overflow-x-auto">
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
      </div>
    </div>
  );
}
