import { prisma } from "@repo/db";
import { Prisma } from "@repo/db";

export type SearchResult = {
  chunkId: string;
  documentId: string;
  content: string;
  order: number;
  documentTitle: string | null;
  documentType: string;
  sourceUrl: string | null;
  similarity: number;
};

export const searchSimilarChunks = async (embedding: number[], userId: string, limit: number, documentId?: string): Promise<SearchResult[]> => {
  // const vectorLiteral = Prisma.raw(`'[${embedding.join(",")}]'::vector`);

  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      c.id as "chunkId",
      c."documentId",
      c.content,
      c."order",
      d.title as "documentTitle",
      d.type as "documentType",
      d."sourceUrl",
      1 - (c.embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM "Chunk" c
    JOIN "Document" d ON c."documentId" = d.id
    WHERE d."userId" = ${userId}
    ${
      documentId
        ? Prisma.sql`AND c."documentId" = ${documentId}`
        : Prisma.empty
    }
    AND d.status = 'COMPLETED'
    ORDER BY c.embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${limit}
  `;

  return results;
};
