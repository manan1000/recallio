import { supabase, BUCKET } from "./client";

export const createSignedDownloadUrl = async (
  filePath: string,
  expiresIn = 900 // 15 minutes
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error || !data) throw new Error(error?.message ?? "Failed to create download URL");

  return data.signedUrl;
};