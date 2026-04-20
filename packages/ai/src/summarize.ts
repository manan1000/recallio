import { openai } from "./openai";

export const summarizeContent = async (content: string): Promise<string> => {
    const words = content.split(/\s+/);
    const totalWords = words.length;

    let textToSummarize: string;

    if (totalWords <= 8000) {
        // fits entirely — use all of it
        textToSummarize = content;
    } else {
        // take first 5000 words + last 2000 words
        const start = words.slice(0, 5000).join(" ");
        const end = words.slice(-3000).join(" ");
        textToSummarize = `${start}\n\n[...]\n\n${end}`;
    }

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "You are a helpful assistant that summarizes content concisely in 3-4 sentences capturing the main ideas. Return only the summary, no preamble.",
            },
            {
                role: "user",
                content: `Summarize this:\n\n${textToSummarize}`,
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