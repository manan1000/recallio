import { openai } from "@repo/ai";
function detectImageMimeType(buffer: Buffer): string {
  // PNG starts with \x89PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  // JPEG starts with \xff\xd8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  // GIF starts with GIF8
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  // WebP starts with RIFF....WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "image/webp";
  // default to jpeg if we can't detect
  return "image/jpeg";
}

export const processImage = async (buffer: Buffer): Promise<string> => {

  const base64 = buffer.toString("base64");
  const mimeType = detectImageMimeType(buffer);


  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: "Describe this image in detail. Include all text, objects, people, colors, and any other relevant information you can see.",
          },
        ],
      },
    ],
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Could not generate image description");

  return content;
};