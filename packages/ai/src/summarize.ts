import { openai } from "./openai";

export const summarizeContent = async (content: string): Promise<string> => {
  // truncate to avoid hitting context limits — first 6000 words is enough for summary
  const truncated = content.split(/\s+/).slice(0, 6000).join(" ");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that summarizes content concisely in 2-3 sentences. Return only the summary, no preamble.",
      },
      {
        role: "user",
        content: `Summarize this:\n\n${truncated}`,
      },
    ],
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
};


/*

// TODO

FUTURE imporvements


*/