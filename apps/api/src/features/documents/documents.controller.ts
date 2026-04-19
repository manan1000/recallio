import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { documentQueue } from "@repo/queue";
import { createDocumentSchema } from "./documents.schema";
import { createSignedDownloadUrl } from "@repo/storage";

export const createDocument = async (req: Request, res: Response) => {
    try {
        const parsed = createDocumentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: {
                    issue: parsed.error.issues[0]?.path[0],
                    message: parsed.error.issues[0]?.message
                }
            });
        }

        const userId = req.user!.id;
        const data = parsed.data;

        // duplicate check for URL based documents
        if ("url" in data) {
            const existing = await prisma.document.findFirst({
                where: { userId, sourceUrl: data.url },
                select: { id: true },
            });
            if (existing) {
                return res.status(409).json({ error: "This URL has already been added" });
            }
        }

        // duplicate check for notes
        if (data.type === "NOTE") {
            const existing = await prisma.document.findFirst({
                where: { userId, type: "NOTE", rawContent: data.content },
                select: { id: true },
            });
            if (existing) {
                return res.status(409).json({ error: "This note already exists" });
            }
        }

        const document = await prisma.document.create({
            data: {
                userId,
                type: data.type,
                title: data.title ?? null,
                sourceUrl: "url" in data ? data.url : null,
                fileUrl: "fileUrl" in data ? data.fileUrl : null,
                fileName: "fileName" in data ? data.fileName : null,
                filePath: "filePath" in data ? data.filePath : null,
                rawContent: data.type === "NOTE" ? data.content : null,
                status: "PENDING",
            },
            select: {
                id: true,
                type: true,
                status: true,
                createdAt: true,
            },
        });

        await documentQueue.add("process", {
            documentId: document.id,
            userId,
        });

        return res.status(202).json({ document });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};

export const listDocuments = async (req: Request, res: Response) => {
    try {
        const documents = await prisma.document.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                type: true,
                title: true,
                sourceUrl: true,
                fileName: true,
                status: true,
                summary: true,
                createdAt: true,
            },
        });

        return res.json({ documents });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};

export const getDocument = async (req: Request, res: Response) => {
    try {
        const docId = req.params.id as string;
        const document = await prisma.document.findUnique({
            where: { id: docId },
            select: {
                id: true,
                type: true,
                title: true,
                sourceUrl: true,
                fileName: true,
                cleanContent: true,
                summary: true,
                status: true,
                error: true,     // show why processing failed
                createdAt: true,
                userId: true,    // for ownership check only, destructure out before response
            }
        });

        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (document.userId !== req.user!.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const resDocument = {
            id: document.id,
            type: document.type,
            title: document.title,
            sourceUrl: document.sourceUrl,
            fileName: document.fileName,
            content: document.type == "NOTE" ? document.cleanContent : null,
            summary: document.summary,
            error: document.error,
            status: document.status,
            createdAt: document.createdAt
        }

        return res.json({ document: resDocument });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};

export const getDocumentStatus = async (req: Request, res: Response) => {
    try {
        const docId = req.params.id as string;
        const document = await prisma.document.findUnique({
            where: { id: docId },
            select: {
                id: true,
                status: true,
                error: true,
                userId: true,
            },
        });

        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (document.userId !== req.user!.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        return res.json({ id: document.id, status: document.status, error: document.error });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};

export const deleteDocument = async (req: Request, res: Response) => {
    try {
        const docId = req.params.id as string;
        const document = await prisma.document.findUnique({
            where: { id: docId },
            select: { id: true, userId: true },
        });

        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (document.userId !== req.user!.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        await prisma.document.delete({ where: { id: docId } });

        return res.json({ message: "Document deleted" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};


export const downloadDocument = async (req: Request, res: Response) => {
    try {
        const docId = req.params.id as string;
        const document = await prisma.document.findUnique({
            where: { id: docId },
            select: { userId: true, filePath: true, fileName: true },
        });

        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (document.userId !== req.user!.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        if (!document.filePath) {
            return res.status(400).json({ error: "No file associated with this document" });
        }

        const downloadUrl = await createSignedDownloadUrl(document.filePath);
        return res.json({ downloadUrl, fileName: document.fileName });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};