export const cleanContent = (raw: string): string => {
    return raw
        .replace(/\r\n/g, "\n")  // normalize line endings
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")   // tabs to spaces
        .replace(/[ ]{2,}/g, " ")   // collapse multiple spaces
        .replace(/\n{3,}/g, "\n\n") // max 2 consecutive newlines
        .trim();
};