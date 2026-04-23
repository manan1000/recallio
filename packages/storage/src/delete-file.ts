import { supabase, BUCKET } from "./client";

export const deleteFile = async (filePath: string): Promise<void> => {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath]);

  if (error) throw new Error(error.message ?? "Failed to delete file");
};