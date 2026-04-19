import { supabase, BUCKET } from "./client";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export type PresignedUploadResult = {
  uploadUrl: string;
  fileUrl: string;
  filePath: string;
};

export const createPresignedUpload = async (
  userId: string,
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<PresignedUploadResult> => {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error("File type not supported");
  }

  if (fileSize > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 20MB limit");
  }

  // unique path per user to avoid collisions
  const ext = fileName.split(".").pop();
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(filePath);

  if (error || !data) throw new Error(error?.message ?? "Failed to create upload URL");

  const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;

  return {
    uploadUrl: data.signedUrl,
    fileUrl,
    filePath,
  };
};