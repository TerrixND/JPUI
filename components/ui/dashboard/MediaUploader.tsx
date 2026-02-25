"use client";

import { useCallback, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type MediaFileType = "IMAGE" | "VIDEO" | "PDF";

export interface MediaFile {
  id: string;
  file: File;
  type: MediaFileType;
  preview: string; // object URL (images) or ""
  isPrimary: boolean;
}

interface MediaUploaderProps {
  files: MediaFile[];
  onChange: (files: MediaFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  maxVideoSizeMB?: number;
  allowedTypes?: MediaFileType[];
  helperText?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ACCEPT_BY_TYPE: Record<MediaFileType, string> = {
  IMAGE: "image/*",
  VIDEO: "video/*",
  PDF: "application/pdf",
};

const buildAcceptString = (allowedTypes?: MediaFileType[]) => {
  const types = allowedTypes?.length ? allowedTypes : (["IMAGE", "VIDEO", "PDF"] as MediaFileType[]);
  return types.map((type) => ACCEPT_BY_TYPE[type]).join(",");
};

const toAllowedTypesLabel = (allowedTypes?: MediaFileType[]) => {
  const types = allowedTypes?.length ? allowedTypes : (["IMAGE", "VIDEO", "PDF"] as MediaFileType[]);
  if (types.length === 1) {
    return types[0];
  }
  if (types.length === 2) {
    return `${types[0]} and ${types[1]}`;
  }
  return `${types.slice(0, -1).join(", ")}, and ${types[types.length - 1]}`;
};

const resolveType = (mime: string): MediaFileType | null => {
  const normalized = mime.trim().toLowerCase();

  if (normalized.startsWith("image/")) {
    return "IMAGE";
  }

  if (normalized.startsWith("video/")) {
    return "VIDEO";
  }

  if (normalized === "application/pdf") {
    return "PDF";
  }

  return null;
};

const uid = () =>
  `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG to avoid extra deps)                             */
/* ------------------------------------------------------------------ */

function UploadCloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-6 3h4" />
    </svg>
  );
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MediaUploader({
  files,
  onChange,
  maxFiles = 10,
  maxSizeMB = 50,
  maxVideoSizeMB = 500,
  allowedTypes,
  helperText,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const acceptedFileTypesLabel = toAllowedTypesLabel(allowedTypes);
  const acceptString = buildAcceptString(allowedTypes);

  /* — process incoming File objects — */
  const processFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError("");
      const list = Array.from(incoming);
      const maxImagePdfBytes = maxSizeMB * 1024 * 1024;
      const maxVideoBytes = maxVideoSizeMB * 1024 * 1024;

      const newMediaFiles: MediaFile[] = [];

      for (const file of list) {
        if (files.length + newMediaFiles.length >= maxFiles) {
          setError(`Maximum ${maxFiles} files allowed.`);
          break;
        }

        const type = resolveType(file.type);
        if (!type) {
          setError(
            `"${file.name}" is not supported. Upload images, videos, or PDFs.`,
          );
          continue;
        }

        if (allowedTypes?.length && !allowedTypes.includes(type)) {
          setError(`"${file.name}" is not allowed in this uploader. Allowed: ${acceptedFileTypesLabel}.`);
          continue;
        }

        const maxAllowedBytes =
          type === "VIDEO" ? maxVideoBytes : maxImagePdfBytes;

        if (file.size > maxAllowedBytes) {
          const maxAllowedMb = type === "VIDEO" ? maxVideoSizeMB : maxSizeMB;
          const fileTypeLabel =
            type === "VIDEO" ? "videos" : type === "PDF" ? "PDF files" : "images";

          setError(
            `"${file.name}" exceeds the ${maxAllowedMb} MB limit for ${fileTypeLabel}.`,
          );
          continue;
        }

        const preview = type === "IMAGE" ? URL.createObjectURL(file) : "";
        const isPrimary =
          type === "IMAGE" &&
          files.filter((f) => f.type === "IMAGE").length === 0 &&
          newMediaFiles.filter((f) => f.type === "IMAGE").length === 0;

        newMediaFiles.push({ id: uid(), file, type, preview, isPrimary });
      }

      if (newMediaFiles.length > 0) {
        onChange([...files, ...newMediaFiles]);
      }
    },
    [acceptedFileTypesLabel, allowedTypes, files, maxFiles, maxSizeMB, maxVideoSizeMB, onChange],
  );

  /* — drag events — */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  };

  /* — actions — */
  const handleRemove = (id: string) => {
    const target = files.find((f) => f.id === id);
    if (target?.preview) URL.revokeObjectURL(target.preview);

    let next = files.filter((f) => f.id !== id);

    // If we removed the primary image, promote the first remaining image
    if (target?.isPrimary) {
      const firstImage = next.find((f) => f.type === "IMAGE");
      if (firstImage) {
        next = next.map((f) =>
          f.id === firstImage.id ? { ...f, isPrimary: true } : f,
        );
      }
    }

    onChange(next);
  };

  const handleSetPrimary = (id: string) => {
    onChange(
      files.map((f) => ({
        ...f,
        isPrimary: f.type === "IMAGE" ? f.id === id : false,
      })),
    );
  };

  /* — counts — */
  const imageCount = files.filter((f) => f.type === "IMAGE").length;
  const videoCount = files.filter((f) => f.type === "VIDEO").length;
  const pdfCount = files.filter((f) => f.type === "PDF").length;

  return (
    <div className="space-y-4">
      {/* Drop-zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-2
          border-2 border-dashed rounded-xl px-6 py-10 cursor-pointer
          transition-colors duration-150
          ${
            dragActive
              ? "border-emerald-500 bg-emerald-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
          }
        `}
      >
        <UploadCloudIcon
          className={`w-10 h-10 ${dragActive ? "text-emerald-500" : "text-gray-400"}`}
        />
        <p className="text-sm text-gray-600 text-center">
          <span className="font-medium text-emerald-600">Click to browse</span>{" "}
          or drag & drop files here
        </p>
        <p className="text-xs text-gray-400">
          {helperText || (
            <>
              Images (image/*) &bull; Videos (video/*) &bull; PDF (application/pdf)
              &mdash; Images/PDF up to {maxSizeMB} MB each, videos up to {maxVideoSizeMB} MB
            </>
          )}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) processFiles(e.target.files);
            e.target.value = ""; // allow re-selecting same file
          }}
        />
      </div>

      {/* Validation error */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Counters */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-gray-700">{files.length} file{files.length !== 1 && "s"}</span>
          {imageCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
              {imageCount} image{imageCount !== 1 && "s"}
            </span>
          )}
          {videoCount > 0 && (
            <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">
              {videoCount} video{videoCount !== 1 && "s"}
            </span>
          )}
          {pdfCount > 0 && (
            <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full">
              {pdfCount} PDF{pdfCount !== 1 && "s"}
            </span>
          )}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((mf) => (
            <div
              key={mf.id}
              className="group relative flex gap-3 items-start bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
            >
              {/* Thumbnail / icon */}
              <div className="shrink-0 w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                {mf.type === "IMAGE" && mf.preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={mf.preview}
                    alt={mf.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : mf.type === "VIDEO" ? (
                  <VideoIcon className="w-7 h-7 text-purple-500" />
                ) : (
                  <PdfIcon className="w-7 h-7 text-orange-500" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {mf.file.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatSize(mf.file.size)}
                </p>

                {/* Badge row */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      mf.type === "IMAGE"
                        ? "bg-blue-50 text-blue-600"
                        : mf.type === "VIDEO"
                          ? "bg-purple-50 text-purple-600"
                          : "bg-orange-50 text-orange-600"
                    }`}
                  >
                    {mf.type}
                  </span>

                  {mf.isPrimary && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-medium">
                      <StarIcon filled className="w-3 h-3" />
                      Primary
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="shrink-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {mf.type === "IMAGE" && !mf.isPrimary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(mf.id)}
                    title="Set as primary image"
                    className="p-1.5 rounded-md text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                  >
                    <StarIcon filled={false} className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(mf.id)}
                  title="Remove file"
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
