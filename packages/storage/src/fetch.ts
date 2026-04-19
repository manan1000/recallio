import { supabase, BUCKET } from "./client";

export const fetchFileAsBuffer = async (filePath: string): Promise<Buffer> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath);

  if (error || !data) throw new Error(error?.message ?? "Failed to fetch file");

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
};