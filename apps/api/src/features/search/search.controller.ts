import { Request, Response } from "express";
import { embedQuery } from "@repo/ai";
import { searchSimilarChunks } from "../chats/chats.search";

const SEARCH_LIMIT = 10;

export const search = async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: "Query parameter q is required" });
        }

        if (query.trim().length < 3) {
            return res.status(400).json({ error: "Query must be at least 3 characters" });
        }

        const userId = req.user!.id;

        const embedding = await embedQuery(query.trim());
        const results = await searchSimilarChunks(embedding, userId, SEARCH_LIMIT);
        const filtered = results.filter((r) => r.similarity > 0.3);

        if (filtered.length === 0) {
            return res.json({
                query,
                results: [],
                message: "No relevant results found",
            });
        }

        return res.json({
            query: query.trim(),
            results: filtered.map((r) => ({
                documentId: r.documentId,
                documentTitle: r.documentTitle,
                documentType: r.documentType,
                sourceUrl: r.sourceUrl,
                content: r.content.slice(0, 300) + "...",
                similarity: Math.round(r.similarity * 100) / 100,
            })),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};