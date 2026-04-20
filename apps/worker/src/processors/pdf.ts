import { extractText } from "unpdf";

export const processPdf = async (buffer: Buffer): Promise<string> => {
    const { text } = await extractText(buffer, { mergePages: true });

    if (!text || text.trim().length === 0) {
        throw new Error("Could not extract text from PDF");
    }

    return text;
};