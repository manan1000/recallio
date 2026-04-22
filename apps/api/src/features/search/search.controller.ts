import { Request, Response } from "express";
import { embedQuery } from "@repo/ai";
import { searchSimilarChunks } from "../chats/chats.search";
import { success, failure } from "../../lib/response";
import { ERROR_CODES } from "@repo/types";

const SEARCH_LIMIT = 10;

export const search = async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const trimmedQuery = query?.trim();

    if (!trimmedQuery || trimmedQuery.length === 0) {
      return failure(res, ERROR_CODES.VALIDATION_ERROR, "Query parameter q is required");
    }

    if (trimmedQuery.length < 3) {
      return res.status(400).json({ error: "Query must be at least 3 characters" });
    }

    const userId = req.user!.id;
    const embedding = await embedQuery(trimmedQuery);
    const results = await searchSimilarChunks(embedding, userId, SEARCH_LIMIT);

    return success(res, {
      query: trimmedQuery,
      results: results.map((r) => ({
        documentId: r.documentId,
        documentTitle: r.documentTitle,
        documentType: r.documentType,
        sourceUrl: r.sourceUrl,
        content: r.content.length > 300 ? r.content.slice(0, 300) + "..." : r.content,
        similarity: Math.round(r.similarity * 100) / 100,
      })),
    });
  } catch (err) {
    console.error(err);
    return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
  }
};