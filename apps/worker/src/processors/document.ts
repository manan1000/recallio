import { extractText } from "unpdf";
import mammoth from "mammoth";

export const processDocument = async (buffer: Buffer, fileName: string): Promise<string> => {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const { text } = await extractText(buffer, { mergePages: true });
    if (!text || text.trim().length === 0) {
      throw new Error("Could not extract text from PDF");
    }
    return text;
  }

  if (ext === "doc" || ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    if (!value || value.trim().length === 0) {
      throw new Error("Could not extract text from document");
    }
    return value;
  }

  throw new Error(`Unsupported document type: .${ext}`);
};