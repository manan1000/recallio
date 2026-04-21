import { openai } from "./openai";

export const embedQuery = async (query: string): Promise<number[]> => {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  return response.data[0]!.embedding;
};