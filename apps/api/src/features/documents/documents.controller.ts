import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { documentQueue } from "@repo/queue";
import { createDocumentSchema, updateDocumentSchema } from "./documents.schema";
import { createSignedDownloadUrl, deleteFile } from "@repo/storage";
import { success, failure, validationFailure } from "../../lib/response";
import { ERROR_CODES } from "@repo/types";

export const createDocument = async (req: Request, res: Response) => {
    try {
        const parsed = createDocumentSchema.safeParse(req.body);
        if (!parsed.success) {
            return validationFailure(res, parsed.error);
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
                return failure(res, ERROR_CODES.CONFLICT, "This URL has already been added");
            }
        }

        // duplicate check for notes
        if (data.type === "NOTE") {
            const existing = await prisma.document.findFirst({
                where: { userId, type: "NOTE", rawContent: data.content },
                select: { id: true },
            });
            if (existing) {
                return failure(res, ERROR_CODES.CONFLICT, "This note already exists");
            }
        }

        if ((data.type === "IMAGE" || data.type === "PDF" || data.type === "DOCUMENT") && !data.filePath.startsWith(`${userId}/`)) {
            return failure(res, ERROR_CODES.FORBIDDEN, "Invalid file path");
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

        return success(res, { document }, 202);
    } catch (err) {
        console.error(err);
        return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
    }
};

export const listDocuments = async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
        const skip = (page - 1) * limit;

        const [documents, total] = await prisma.$transaction([
            prisma.document.findMany({
                where: { userId: req.user!.id },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
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
            }),
            prisma.document.count({
                where: { userId: req.user!.id },
            }),
        ]);

        return success(res, {
            documents,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error(err);
        return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
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
            return failure(res, ERROR_CODES.NOT_FOUND, "Document not found");
        }

        if (document.userId !== req.user!.id) {
            return failure(res, ERROR_CODES.FORBIDDEN, "Forbidden");
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

        return success(res, { document: resDocument });
    } catch (err) {
        console.error(err);
        return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
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
            return failure(res, ERROR_CODES.NOT_FOUND, "Document not found");
        }

        if (document.userId !== req.user!.id) {
            return failure(res, ERROR_CODES.FORBIDDEN, "Forbidden");
        }
        return success(res, { id: document.id, status: document.status, error: document.error });
    } catch (err) {
        console.error(err);
        return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
    }
};

export const updateDocument = async (req: Request, res: Response) => {
    try {
        const docId = req.params.id as string;

        const parsed = updateDocumentSchema.safeParse(req.body);

        if (!parsed.success) return validationFailure(res, parsed.error);

        const document = await prisma.document.findUnique({
            where: { id: docId },
            select: { id: true, userId: true, type: true },
        });

        if (!document) return failure(res, ERROR_CODES.NOT_FOUND, "Document not found");
        if (document.userId !== req.user!.id) return failure(res, ERROR_CODES.FORBIDDEN, "Forbidden");
        if (document.type !== "NOTE") {
            return failure(res, ERROR_CODES.VALIDATION_ERROR, "Only notes can be edited");
        }

        //delete all existing chunks — their embeddings are now stale
        // since the content has changed, keeping them would poison the vector search
        await prisma.chunk.deleteMany({ where: { documentId: docId } });

        // update the document — only rawContent and title
        // cleanContent and summary are left for the worker to regenerate
        // status resets to PENDING so the UI shows the document is being re-processed
        const updated = await prisma.document.update({
            where: { id: docId },
            data: {
                ...(parsed.data.title && { title: parsed.data.title }),
                ...(parsed.data.content && { rawContent: parsed.data.content }),
                // clear the old summary and cleanContent since they're now stale
                cleanContent: null,
                summary: null,
                status: "PENDING",
                error: null,
            },
            select: {
                id: true,
                type: true,
                status: true,
                createdAt: true,
            },
        });

        // add back to the processing queue so the worker re-embeds the new content
        await documentQueue.add("process", {
            documentId: updated.id,
            userId: req.user!.id,
        });
        return success(res, { document: updated }, 202);
    } catch (err) {
        console.error(err);
        return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
    }
};

export const deleteDocument = async (req: Request, res: Response) => {
    try {
        const docId = req.params.id as string;
        const document = await prisma.document.findUnique({
            where: { id: docId },
            // fetch filePath so we know what to delete from Supabase
            select: { id: true, userId: true, type: true, filePath: true },
        });

        if (!document) return failure(res, ERROR_CODES.NOT_FOUND, "Document not found");
        if (document.userId !== req.user!.id) return failure(res, ERROR_CODES.FORBIDDEN, "Forbidden");

        if (document.filePath && ["PDF", "IMAGE", "DOCUMENT"].includes(document.type)
        ) {
            try {
                await deleteFile(document.filePath);
            } catch (err) {
                // log but don't fail the whole request — a missing Supabase file
                // shouldn't prevent the user from cleaning up their knowledge base
                console.error(`Failed to delete file from Supabase: ${document.filePath}`, err);
            }
        }
        await prisma.document.delete({ where: { id: docId } });
        return success(res, { message: "Document deleted" });
    } catch (err) {
        console.error(err);
        return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
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
            return failure(res, ERROR_CODES.NOT_FOUND, "Document not found");
        }

        if (document.userId !== req.user!.id) {
            return failure(res, ERROR_CODES.FORBIDDEN, "Forbidden");
        }

        if (!document.filePath) {
            return failure(res, ERROR_CODES.NOT_FOUND, "No file associated with this document");
        }

        const downloadUrl = await createSignedDownloadUrl(document.filePath);
        return success(res, { downloadUrl, fileName: document.fileName });
    } catch (err) {
        console.error(err);
        return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
    }
};

export const retryDocument = async (req: Request, res: Response) => {
    try {
        const docId = req.params.id as string;

        const document = await prisma.document.findUnique({
            where: { id: docId },
            select: { id: true, userId: true, status: true },
        });

        if (!document) return failure(res, ERROR_CODES.NOT_FOUND, "Document not found");
        if (document.userId !== req.user!.id) return failure(res, ERROR_CODES.FORBIDDEN, "Forbidden");
        if (document.status !== "FAILED") {
            return failure(res, ERROR_CODES.VALIDATION_ERROR, "Only failed documents can be retried");
        }

        // reset status and clear error
        await prisma.document.update({
            where: { id: docId },
            data: { status: "PENDING", error: null },
        });

        // re-add to queue
        await documentQueue.add("process", {
            documentId: docId,
            userId: req.user!.id,
        });

        return success(res, { message: "Document queued for reprocessing" });
    } catch (err) {
        console.error(err);
        return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
    }
};