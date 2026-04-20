import { openai } from "@repo/ai";

export const processImage = async (fileUrl: string): Promise<string> => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: fileUrl, detail: "high" },
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