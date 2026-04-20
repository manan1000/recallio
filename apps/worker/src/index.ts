import "dotenv/config";
import { Job, UnrecoverableError, Worker } from "bullmq";
import { redis, DocumentJobData } from "@repo/queue";
import { prisma } from "@repo/db";
import { cleanContent, chunkText, embedChunks, summarizeContent } from "@repo/ai";
import { fetchFileAsBuffer } from "@repo/storage";
import { processLink } from "./processors/link";
import { processYoutube } from "./processors/youtube";
import { processNote } from "./processors/note";
import { processPdf } from "./processors/pdf";
import { processImage } from "./processors/image";
import { processDocument } from "./processors/document";
import { createId } from "@paralleldrive/cuid2";

const worker = new Worker<DocumentJobData>("document-processing", async (job: Job) => {
    const { documentId, userId } = job.data;
    console.log(`Processing document ${documentId}`);

    // fetch document from DB
    const document = await prisma.document.findUnique({
        where: { id: documentId },
    });

    if (!document) throw new UnrecoverableError(`Document ${documentId} not found`);

    if (document.userId !== userId) throw new UnrecoverableError(`Document does not belong to user`); // then should remove the job from queue

    // set status to PROCESSING
    await prisma.document.update({
        where: { id: documentId },
        data: { status: "PROCESSING" },
    });


    try {
        // Step 1 — extract raw content based on type
        let rawText = "";

        switch (document.type) {
            case "LINK": {
                if (!document.sourceUrl) throw new UnrecoverableError("Missing source URL");
                rawText = await processLink(document.sourceUrl);
                break;
            }
            case "YOUTUBE": {
                if (!document.sourceUrl) throw new UnrecoverableError("Missing source URL");
                rawText = await processYoutube(document.sourceUrl);
                break;
            }
            case "NOTE": {
                if (!document.rawContent) throw new UnrecoverableError("Missing note content");
                rawText = processNote(document.rawContent);
                break;
            }
            case "PDF": {
                if (!document.filePath) throw new UnrecoverableError("Missing file path");
                const buffer = await fetchFileAsBuffer(document.filePath);
                rawText = await processPdf(buffer);
                break;
            }
            case "IMAGE": {
                if (!document.fileUrl) throw new UnrecoverableError("Missing file URL");
                rawText = await processImage(document.fileUrl);
                break;
            }
            case "DOCUMENT": {
                if (!document.filePath) throw new UnrecoverableError("Missing file path");
                if (!document.fileName) throw new UnrecoverableError("Missing file name");
                const buffer = await fetchFileAsBuffer(document.filePath);
                rawText = await processDocument(buffer, document.fileName);
                break;
            }
            default:
                throw new UnrecoverableError(`Unknown document type`);
        }

        // Step 2 — clean content
        const clean = cleanContent(rawText);

        // Step 3 — chunk
        const chunks = chunkText(clean);
        if (chunks.length === 0) throw new Error("No chunks generated");

        // Step 4 — embed
        const embeddedChunks = await embedChunks(chunks);



        // Step 5 — delete chunks if process failed then save chunks to DB
        await prisma.$transaction(async (tx) => {
            await tx.chunk.deleteMany({
                where: { documentId },
            });
            await Promise.all(      // runs all inserts concurrently (faster than sequential inserts).
                embeddedChunks.map(async (chunk) => {
                    const id = createId();
                    await tx.$executeRaw`
                    INSERT INTO "Chunk" (id, "documentId", content, "order", embedding, "createdAt")
                    VALUES (
                        ${id},
                        ${documentId},
                        ${chunk.content},
                        ${chunk.order},
                        ${JSON.stringify(chunk.embedding)}::vector,
                        NOW()
                    )
                `;
            }));
        });


    // Step 6 — generate summary
    const summary = await summarizeContent(clean);

    // Step 7 — mark as COMPLETED
    await prisma.document.update({
        where: { id: documentId },
        data: {
            cleanContent: clean,
            summary,
            status: "COMPLETED",
            error: null,
        },
    });

    console.log(`Document ${documentId} processed successfully — ${chunks.length} chunks`);
} catch (err: any) {
    // mark as FAILED with error message
    await prisma.document.update({
        where: { id: documentId },
        data: {
            status: "FAILED",
            error: err.message ?? "Unknown error",
        },
    });

    throw err; // rethrow so BullMQ records the failure and retries
}
},
{
    connection: redis,
        concurrency: 5, // process up to 5 documents at once
    }
);

worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
});

console.log("Worker started, waiting for jobs...");