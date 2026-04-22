import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { documentQueue } from "@repo/queue";
import { createDocumentSchema } from "./documents.schema";
import { createSignedDownloadUrl } from "@repo/storage";
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

export const deleteDocument = async (req: Request, res: Response) => {
    try {
        const docId = req.params.id as string;
        const document = await prisma.document.findUnique({
            where: { id: docId },
            select: { id: true, userId: true },
        });

        if (!document) {
            return failure(res, ERROR_CODES.NOT_FOUND, "Document not found");
        }

        if (document.userId !== req.user!.id) {
            return failure(res, ERROR_CODES.FORBIDDEN, "Forbidden");
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