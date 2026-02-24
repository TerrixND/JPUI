"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import supabase from "@/lib/supabase";
import {
  clearAdminAuditLogs,
  downloadAdminLogBackup,
  getAdminAuditLogs,
  getAdminLogBackups,
  type AdminAuditLogRow,
  type AdminLogBackupFile,
} from "@/lib/apiClient";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const FALLBACK_ACTION_FILTER = "__ALL__";

type Filters = {
  query: string;
  actorId: string;
  action: string;
  from: string;
  to: string;
};

const initialFilters: Filters = {
  query: "",
  actorId: "",
  action: FALLBACK_ACTION_FILTER,
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

const formatBytes = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const makeDownloadFileName = (response: Response, fallback: string) => {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);

  if (!match?.[1]) {
    return fallback;
  }

  return decodeURIComponent(match[1].replace(/"/g, "").trim());
};

export default function AdminLogs() {
  const [auditRows, setAuditRows] = useState<AdminAuditLogRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState("");

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

  const [backups, setBackups] = useState<AdminLogBackupFile[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [backupsError, setBackupsError] = useState("");
  const [downloadingFileName, setDownloadingFileName] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    const accessToken = session?.access_token || "";
    if (!accessToken) {
      throw new Error("Missing access token. Please sign in again.");
    }

    return accessToken;
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminAuditLogs({
        accessToken,
        page,
        limit,
        query: appliedFilters.query.trim() || undefined,
        actorId: appliedFilters.actorId.trim() || undefined,
        action:
          appliedFilters.action && appliedFilters.action !== FALLBACK_ACTION_FILTER
            ? appliedFilters.action
            : undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
      });

      setAuditRows(response.items);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (error) {
      setAuditRows([]);
      setTotal(0);
      setTotalPages(1);
      setAuditError(getErrorMessage(error));
    } finally {
      setAuditLoading(false);
    }
  }, [appliedFilters, getAccessToken, limit, page]);

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    setBackupsError("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminLogBackups({
        accessToken,
        type: "audit",
      });
      setBackups(response.files);
    } catch (error) {
      setBackups([]);
      setBackupsError(getErrorMessage(error));
    } finally {
      setBackupsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  useEffect(() => {
    if (page <= totalPages) {
      return;
    }

    setPage(totalPages);
  }, [page, totalPages]);

  const actionOptions = useMemo(() => {
    const fromRows = new Set(
      auditRows
        .map((row) => row.action.trim())
        .filter((action) => Boolean(action)),
    );

    if (
      draftFilters.action &&
      draftFilters.action !== FALLBACK_ACTION_FILTER
    ) {
      fromRows.add(draftFilters.action);
    }

    return [FALLBACK_ACTION_FILTER, ...Array.from(fromRows).sort()];
  }, [auditRows, draftFilters.action]);

  const onApplyFilters = () => {
    setPage(1);
    setAppliedFilters(draftFilters);
  };

  const onResetFilters = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const onClearAuditLogs = async () => {
    setClearError("");
    setClearMessage("");

    if (!clearReason.trim()) {
      setClearError("Reason is required.");
      return;
    }

    setClearing(true);

    try {
      const accessToken = await getAccessToken();
      const result = await clearAdminAuditLogs(clearReason.trim(), {
        accessToken,
      });

      const backupParts = [
        result.backupFileName ? `backup: ${result.backupFileName}` : "",
        result.backupRecordCount !== null ? `records: ${result.backupRecordCount}` : "",
      ].filter(Boolean);

      setClearMessage(
        backupParts.length
          ? `${result.message} (${backupParts.join(", ")})`
          : result.message,
      );
      setClearReason("");

      await Promise.all([loadAuditLogs(), loadBackups()]);
    } catch (error) {
      setClearError(getErrorMessage(error));
    } finally {
      setClearing(false);
    }
  };

  const onDownloadBackup = async (fileName: string) => {
    setDownloadingFileName(fileName);
    setBackupsError("");

    try {
      const accessToken = await getAccessToken();
      const response = await downloadAdminLogBackup({
        accessToken,
        fileName,
      });

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const downloadName = makeDownloadFileName(response, fileName);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setBackupsError(getErrorMessage(error));
    } finally {
      setDownloadingFileName("");
    }
  };

  const currentPageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const currentPageEnd = Math.min(total, page * limit);
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs & Backups"
        description="Review admin audit events and manage audit log backups."
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <input
            type="text"
            value={draftFilters.query}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, query: e.target.value }))}
            placeholder="Search message/action/target"
            className="lg:col-span-2 px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <input
            type="text"
            value={draftFilters.actorId}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, actorId: e.target.value }))}
            placeholder="Actor ID"
            className="px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <select
            value={draftFilters.action}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, action: e.target.value }))}
            className="px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action === FALLBACK_ACTION_FILTER ? "All Actions" : action}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={draftFilters.from}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, from: e.target.value }))}
            className="px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          <input
            type="date"
            value={draftFilters.to}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, to: e.target.value }))}
            className="px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
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
            <label className="text-xs text-gray-500">Rows per page</label>
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

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-red-800">
          Clear Audit Logs
        </p>
        <p className="text-xs text-red-700">
          Clearing logs is irreversible. A backup file is generated before deletion.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={clearReason}
            onChange={(e) => setClearReason(e.target.value)}
            placeholder="Reason for clearing logs"
            className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-red-200 rounded-lg outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-colors"
          />
          <button
            type="button"
            onClick={() => void onClearAuditLogs()}
            disabled={clearing}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {clearing ? "Clearing..." : "Clear Audit Logs"}
          </button>
        </div>
        {clearError && <p className="text-xs text-red-700">{clearError}</p>}
        {clearMessage && <p className="text-xs text-emerald-700">{clearMessage}</p>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Audit Logs</h2>
          <p className="text-xs text-gray-500">
            {currentPageStart}-{currentPageEnd} of {total}
          </p>
        </div>
        {auditLoading ? (
          <div className="px-5 py-8 text-sm text-gray-500">Loading audit logs...</div>
        ) : auditError ? (
          <div className="px-5 py-8 text-sm text-red-600">{auditError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-mono">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      <p className="font-mono text-xs">{row.actorId || "-"}</p>
                      <p className="text-[11px] text-gray-500">{row.actorEmail || ""}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      <p className="text-xs">{row.targetType || "-"}</p>
                      <p className="font-mono text-[11px] text-gray-500">{row.targetId || ""}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600 max-w-md">
                      <p className="break-words">{row.message || "-"}</p>
                    </td>
                  </tr>
                ))}

                {auditRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={!canGoPrev}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={!canGoNext}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Audit Backups <span className="text-sm font-normal text-gray-400">({backups.length} files)</span>
          </h2>
        </div>

        {backupsLoading ? (
          <div className="px-5 py-8 text-sm text-gray-500">Loading backup files...</div>
        ) : backupsError ? (
          <div className="px-5 py-8 text-sm text-red-600">{backupsError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                  <th className="px-5 py-3 font-medium">File Name</th>
                  <th className="px-5 py-3 font-medium">Records</th>
                  <th className="px-5 py-3 font-medium">Size</th>
                  <th className="px-5 py-3 font-medium">Generated</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((file) => (
                  <tr key={file.fileName} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-gray-700">{file.fileName}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{file.recordCount ?? "-"}</td>
                    <td className="px-5 py-3 text-gray-600">{formatBytes(file.sizeBytes)}</td>
                    <td className="px-5 py-3 text-gray-500">{formatDateTime(file.generatedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void onDownloadBackup(file.fileName)}
                        disabled={Boolean(downloadingFileName)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {downloadingFileName === file.fileName ? "Downloading..." : "Download"}
                      </button>
                    </td>
                  </tr>
                ))}

                {backups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                      No backup files found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
