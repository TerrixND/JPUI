"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/dashboard/PageHeader";
import { useRole } from "@/components/ui/dashboard/RoleContext";
import supabase from "@/lib/supabase";
import {
  ApiClientError,
  getAdminProductCertificateById,
  saveAdminProductCertificate,
  type AdminGeneratedCertificateRecord,
} from "@/lib/apiClient";

const executeEditorCommand = (command: string) => {
  if (typeof document === "undefined") {
    return;
  }

  document.execCommand(command, false);
};

const toSafeString = (value: unknown) => (typeof value === "string" ? value : "");

export default function AdminCertificateEditorPage() {
  const params = useParams<{ certificateId: string }>();
  const { dashboardBasePath, isAdminActionBlocked } = useRole();
  const certificateId = String(params?.certificateId || "").trim();
  const productEditBlocked = isAdminActionBlocked("PRODUCT_EDIT");

  const editorRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [certificate, setCertificate] = useState<AdminGeneratedCertificateRecord | null>(null);
  const [editorHtml, setEditorHtml] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const token = session?.access_token;
    if (!token) {
      throw new Error("Admin session not found.");
    }

    return token;
  }, []);

  const hydrateEditor = useCallback((htmlContent: string) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.innerHTML = htmlContent;
    setEditorHtml(htmlContent);
  }, []);

  const loadCertificate = useCallback(async () => {
    if (!certificateId) {
      setError("Certificate ID is required.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      const response = await getAdminProductCertificateById({
        accessToken,
        certificateId,
      });

      if (!response.certificate) {
        throw new Error("Certificate record not found.");
      }

      setCertificate(response.certificate);
      hydrateEditor(response.certificate.htmlContent || "");
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiClientError
          ? caughtError.message
          : caughtError instanceof Error
            ? caughtError.message
            : "Failed to load certificate.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [certificateId, getAccessToken, hydrateEditor]);

  useEffect(() => {
    void loadCertificate();
  }, [loadCertificate]);

  const extractedFieldRows = useMemo(() => {
    const fields = certificate?.extractedFields;
    if (!fields) {
      return [];
    }

    return Object.entries(fields)
      .map(([key, value]) => ({
        key,
        value: typeof value === "string" ? value : JSON.stringify(value),
      }))
      .filter((entry) => entry.value && entry.value !== "null");
  }, [certificate?.extractedFields]);

  const handleSave = async () => {
    setError("");
    setNotice("");

    if (productEditBlocked) {
      setError("Product edit is currently restricted for your account.");
      return;
    }

    if (!certificateId || !editorRef.current) {
      setError("Certificate editor is not ready.");
      return;
    }

    try {
      setSaving(true);
      const accessToken = await getAccessToken();
      const htmlContent = toSafeString(editorRef.current.innerHTML);
      const response = await saveAdminProductCertificate({
        accessToken,
        certificateId,
        htmlContent,
      });

      if (!response.certificate) {
        throw new Error("Certificate save response was invalid.");
      }

      setCertificate(response.certificate);
      hydrateEditor(response.certificate.htmlContent || htmlContent);
      setNotice(response.message || "Certificate saved.");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to save certificate.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const productsPath = `${dashboardBasePath}/products`;
  const backToProductPath = certificate?.productId
    ? `${productsPath}/${certificate.productId}`
    : productsPath;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Certificate Editor"
          action={
            <Link
              href={productsPath}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Back to Products
            </Link>
          }
        />
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-gray-300">
          Loading certificate...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificate Editor"
        description="Edit generated certificate HTML, then save to regenerate PDF and publish preview."
        action={
          <Link
            href={backToProductPath}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Back
          </Link>
        }
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => executeEditorCommand("bold")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Bold
            </button>
            <button
              type="button"
              onClick={() => executeEditorCommand("italic")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Italic
            </button>
            <button
              type="button"
              onClick={() => executeEditorCommand("underline")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Underline
            </button>
            <button
              type="button"
              onClick={() => executeEditorCommand("insertUnorderedList")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Bullet List
            </button>
            <button
              type="button"
              onClick={() => executeEditorCommand("justifyLeft")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => executeEditorCommand("justifyCenter")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Center
            </button>
            <button
              type="button"
              onClick={() => executeEditorCommand("justifyRight")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Right
            </button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              setEditorHtml(toSafeString(editorRef.current?.innerHTML));
            }}
            className="min-h-[620px] w-full rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-100"
          />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (certificate?.htmlContent) {
                  hydrateEditor(certificate.htmlContent);
                }
              }}
              disabled={saving}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={saving || productEditBlocked}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Certificate"}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Certificate Info</h2>
            <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">ID:</span> {certificate?.id || "-"}</p>
              <p><span className="font-medium">Status:</span> {certificate?.status || "-"}</p>
              <p><span className="font-medium">Version:</span> {certificate?.version ?? 1}</p>
              <p><span className="font-medium">Template:</span> {certificate?.templateName || "DEFAULT_V1"}</p>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {certificate?.htmlSignedUrl ? (
                <a
                  href={certificate.htmlSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Open Saved HTML
                </a>
              ) : null}
              {certificate?.pdfSignedUrl ? (
                <a
                  href={certificate.pdfSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Open Saved PDF
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Extracted Fields</h2>
            {extractedFieldRows.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">No extracted fields.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {extractedFieldRows.map((entry) => (
                  <div
                    key={entry.key}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/40"
                  >
                    <p className="font-medium text-gray-700 dark:text-gray-200">{entry.key}</p>
                    <p className="mt-0.5 text-gray-600 dark:text-gray-300 break-words">{entry.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700/60 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Live HTML Preview</h2>
            <iframe
              title="Certificate HTML Preview"
              srcDoc={editorHtml}
              className="mt-3 h-[320px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
