import {
  createMediaPresign,
  createMediaRecord,
  uploadFileToPresignedUrl,
  type CustomerTier,
  type MediaAudience,
  type MediaRole,
  type MediaRecord,
  type MediaSection,
  type MediaSlot,
  type MediaVisibilityPreset,
} from "@/lib/apiClient";

const IMAGE_PDF_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_MAX_BYTES = 500 * 1024 * 1024;

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
  consignmentAgreementId,
  slot,
  displayOrder,
  visibilitySections,
  audience,
  visibilityPreset,
  allowedRoles,
  minCustomerTier,
  targetUserIds,
}: {
  file: File;
  accessToken: string;
  productId?: string;
  consignmentAgreementId?: string;
  slot?: MediaSlot;
  displayOrder?: number;
  visibilitySections?: MediaSection[];
  audience?: MediaAudience;
  visibilityPreset?: MediaVisibilityPreset;
  allowedRoles?: MediaRole[];
  minCustomerTier?: CustomerTier;
  targetUserIds?: string[];
}): Promise<MediaRecord> => {
  const validationError = validateMediaFileForUpload(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const mimeType = file.type;
  const sizeBytes = file.size;
  const mediaType = resolveMediaType(mimeType);

  if (!mediaType) {
    throw new Error(`"${file.name}" has an unsupported file type.`);
  }

  let presignResult: Awaited<ReturnType<typeof createMediaPresign>>;
  try {
    presignResult = await createMediaPresign({
      accessToken,
      fileName: file.name,
      contentType: mimeType,
      sizeBytes,
      productId,
      consignmentAgreementId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error.";

    throw new Error(`Unable to request upload URL for "${file.name}". ${message}`);
  }

  try {
    await uploadFileToPresignedUrl({
      uploadUrl: presignResult.uploadUrl,
      file,
      contentType: mimeType,
      method: presignResult.uploadMethod,
      headers: presignResult.uploadHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error.";

    throw new Error(`Unable to upload "${file.name}" to storage. ${message}`);
  }

  try {
    return await createMediaRecord({
      accessToken,
      key: presignResult.key,
      mimeType,
      sizeBytes,
      productId,
      consignmentAgreementId,
      slot,
      displayOrder,
      visibilitySections,
      audience,
      visibilityPreset,
      allowedRoles,
      minCustomerTier,
      targetUserIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error.";

    throw new Error(`Unable to create media record for "${file.name}". ${message}`);
  }
};

export const uploadMediaFiles = async ({
  files,
  accessToken,
  productId,
  consignmentAgreementId,
  slot,
  visibilitySections,
  audience,
  visibilityPreset,
  allowedRoles,
  minCustomerTier,
  targetUserIds,
}: {
  files: File[];
  accessToken: string;
  productId?: string;
  consignmentAgreementId?: string;
  slot?: MediaSlot;
  visibilitySections?: MediaSection[];
  audience?: MediaAudience;
  visibilityPreset?: MediaVisibilityPreset;
  allowedRoles?: MediaRole[];
  minCustomerTier?: CustomerTier;
  targetUserIds?: string[];
}) => {
  const uploaded: MediaRecord[] = [];

  for (const file of files) {
    const media = await uploadSingleMediaFile({
      file,
      accessToken,
      productId,
      consignmentAgreementId,
      slot,
      displayOrder: uploaded.length,
      visibilitySections,
      audience,
      visibilityPreset,
      allowedRoles,
      minCustomerTier,
      targetUserIds,
    });

    uploaded.push(media);
  }

  return uploaded;
};
