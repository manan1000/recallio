const CHUNK_SIZE = 600;
const OVERLAP = 80;

export type Chunk = {
  content: string;
  order: number;
};

export const chunkText = (text: string): Chunk[] => {
  const words = text.split(/\s+/).filter(Boolean); //Splits the string wherever there’s one or more whitespace characters (spaces, tabs, newlines)
  const chunks: Chunk[] = [];
  let i = 0;
  let order = 0;

  while (i < words.length) {
    const chunkWords = words.slice(i, i + CHUNK_SIZE);
    const content = chunkWords.join(" ");

    if (content.trim().length > 0) {
      chunks.push({ content, order });
      order++;
    }

    // if this is the last chunk, stop
    if (i + CHUNK_SIZE >= words.length) break;

    i += CHUNK_SIZE - OVERLAP;
  }

  return chunks;
};


/* 
// TODO

FUTURE improvements
1. want:
paragraph-aware chunking
or sentence-aware chunking
or token-based chunking (best for OpenAI)

const MAX_TOKENS = 800;
const OVERLAP_SENTENCES = 2;

export const chunkTextAdvanced = (text: string): Chunk[] => {
  const paragraphs = splitIntoParagraphs(text);

  const chunks: Chunk[] = [];
  let currentChunk: string[] = [];
  let order = 0;

  for (const para of paragraphs) {
    const sentences = splitIntoSentences(para);

    for (const sentence of sentences) {
      currentChunk.push(sentence);

      const joined = currentChunk.join(" ");
      const tokenCount = estimateTokens(joined);

      if (tokenCount >= MAX_TOKENS) {
        // push chunk
        chunks.push({
          content: joined.trim(),
          order,
        });
        order++;

        // overlap: keep last N sentences
        currentChunk = currentChunk.slice(-OVERLAP_SENTENCES);
      }
    }
  }

  // push remaining
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join(" ").trim(),
      order,
    });
  }

  return chunks;
};

*/
