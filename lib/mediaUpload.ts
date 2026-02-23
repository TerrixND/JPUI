const MEDIA_PRESIGN_ENDPOINT = "/api/v1/media/presign";
const MEDIA_CREATE_ENDPOINT = "/api/v1/media";

const IMAGE_PDF_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_MAX_BYTES = 500 * 1024 * 1024;

type MediaApiErrorPayload = {
  message?: unknown;
  code?: unknown;
  reason?: unknown;
};

type MediaPresignPayload = {
  uploadUrl?: unknown;
  key?: unknown;
  message?: unknown;
  code?: unknown;
  reason?: unknown;
};

type MediaRecordPayload = {
  id?: unknown;
  type?: unknown;
  url?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
  productId?: unknown;
  uploadedByUserId?: unknown;
  createdAt?: unknown;
};

export type MediaRecord = {
  id: string;
  type: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  productId: string | null;
  uploadedByUserId: string | null;
  createdAt: string;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const toMb = (bytes: number) => Math.floor(bytes / (1024 * 1024));

const resolveMediaType = (mimeType: string): "IMAGE" | "VIDEO" | "PDF" | null => {
  const normalized = mimeType.trim().toLowerCase();

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

const buildApiErrorMessage = (
  payload: MediaApiErrorPayload | null,
  fallback: string,
) => {
  const message =
    typeof payload?.message === "string" ? payload.message : fallback;
  const code = typeof payload?.code === "string" ? payload.code : "";
  const reason = typeof payload?.reason === "string" ? payload.reason : "";

  if (code && reason) {
    return `${message} (code: ${code}, reason: ${reason})`;
  }

  if (code) {
    return `${message} (code: ${code})`;
  }

  if (reason) {
    return `${message} (reason: ${reason})`;
  }

  return message;
};

const normalizeMediaRecord = (payload: unknown): MediaRecord | null => {
  const root = asObject(payload);
  if (!root) {
    return null;
  }

  const candidate =
    asObject(root.media) ??
    (root as Record<string, unknown>);

  const media = candidate as MediaRecordPayload;

  const id = asString(media.id);
  const url = asString(media.url);
  const mimeType = asString(media.mimeType);
  const createdAt = asString(media.createdAt);

  if (!id || !url || !mimeType || !createdAt) {
    return null;
  }

  const sizeBytes =
    typeof media.sizeBytes === "number" && Number.isFinite(media.sizeBytes)
      ? media.sizeBytes
      : -1;

  if (sizeBytes < 0) {
    return null;
  }

  return {
    id,
    type: asString(media.type),
    url,
    mimeType,
    sizeBytes,
    productId:
      typeof media.productId === "string"
        ? media.productId
        : media.productId === null
          ? null
          : null,
    uploadedByUserId:
      typeof media.uploadedByUserId === "string"
        ? media.uploadedByUserId
        : media.uploadedByUserId === null
          ? null
          : null,
    createdAt,
  };
};

export const validateMediaFileForUpload = (file: File): string | null => {
  const mediaType = resolveMediaType(file.type);

  if (!mediaType) {
    return `"${file.name}" has an unsupported file type. Only image/*, video/*, and application/pdf are allowed.`;
  }

  const maxSize = mediaType === "VIDEO" ? VIDEO_MAX_BYTES : IMAGE_PDF_MAX_BYTES;
  if (file.size > maxSize) {
    const maxMb = mediaType === "VIDEO" ? toMb(VIDEO_MAX_BYTES) : toMb(IMAGE_PDF_MAX_BYTES);
    const typeLabel =
      mediaType === "VIDEO" ? "videos" : mediaType === "PDF" ? "PDF files" : "images";

    return `"${file.name}" exceeds the ${maxMb} MB limit for ${typeLabel}.`;
  }

  return null;
};

export const uploadSingleMediaFile = async ({
  file,
  accessToken,
  productId,
}: {
  file: File;
  accessToken: string;
  productId?: string;
}): Promise<MediaRecord> => {
  const validationError = validateMediaFileForUpload(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const mimeType = file.type;
  const sizeBytes = file.size;

  const presignBody = JSON.stringify({
    contentType: mimeType,
    sizeBytes,
    ...(productId ? { productId } : {}),
  });

  let presignResponse: Response;

  try {
    presignResponse = await fetch(MEDIA_PRESIGN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: presignBody,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error.";

    throw new Error(
      `Unable to request upload URL for "${file.name}". ${message}`,
    );
  }

  const presignPayload =
    (await presignResponse
      .json()
      .catch(() => null)) as MediaPresignPayload | null;

  if (!presignResponse.ok) {
    throw new Error(
      buildApiErrorMessage(
        presignPayload,
        `Failed to request upload URL for "${file.name}".`,
      ),
    );
  }

  const uploadUrl = asString(presignPayload?.uploadUrl);
  const key = asString(presignPayload?.key);

  if (!uploadUrl || !key) {
    throw new Error(`Invalid upload URL response for "${file.name}".`);
  }

  let uploadResponse: Response;

  try {
    uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
      },
      body: file,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error.";

    throw new Error(
      `Unable to upload "${file.name}" to storage. ${message}`,
    );
  }

  if (!uploadResponse.ok) {
    throw new Error(
      `Failed to upload "${file.name}" to storage (status ${uploadResponse.status}).`,
    );
  }

  let createResponse: Response;

  try {
    createResponse = await fetch(MEDIA_CREATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        key,
        mimeType,
        sizeBytes,
        ...(productId ? { productId } : {}),
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error.";

    throw new Error(
      `Unable to create media record for "${file.name}". ${message}`,
    );
  }

  const createPayload = (await createResponse.json().catch(() => null)) as
    | MediaApiErrorPayload
    | Record<string, unknown>
    | null;

  if (createResponse.status !== 200 && createResponse.status !== 201) {
    throw new Error(
      buildApiErrorMessage(
        createPayload as MediaApiErrorPayload | null,
        `Failed to create media record for "${file.name}".`,
      ),
    );
  }

  const mediaRecord = normalizeMediaRecord(createPayload);
  if (!mediaRecord) {
    throw new Error(`Invalid media record response for "${file.name}".`);
  }

  return mediaRecord;
};

export const uploadMediaFiles = async ({
  files,
  accessToken,
  productId,
}: {
  files: File[];
  accessToken: string;
  productId?: string;
}) => {
  const uploaded: MediaRecord[] = [];

  for (const file of files) {
    const media = await uploadSingleMediaFile({
      file,
      accessToken,
      productId,
    });

    uploaded.push(media);
  }

  return uploaded;
};
