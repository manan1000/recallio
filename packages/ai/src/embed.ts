import { openai } from "./openai";
import type { Chunk } from "./chunk";

const BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs per request

export type EmbeddedChunk = Chunk & {
    embedding: number[];
};

export const embedChunks = async (chunks: Chunk[]): Promise<EmbeddedChunk[]> => {
    const results: EmbeddedChunk[] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const inputs = batch.map((c) => c.content);

        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: inputs,
        });

        for (let j = 0; j < batch.length; j++) {
            results.push({
                ...batch[j]!,
                embedding: response.data[j]!.embedding,
            });
        }
    }

    return results;
};


/*

// TODO

FUTURE improvements
1. Parallel batches (faster)
2. Retry logic - If API fails: retry batch, don’t lose progress
*/