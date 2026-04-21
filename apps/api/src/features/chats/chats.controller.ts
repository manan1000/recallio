import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { openai, embedQuery } from "@repo/ai";
import { createChatSchema, sendMessageSchema } from "./chat.schema";
import { searchSimilarChunks } from "./chats.search";

const SCOPED_K = 5;
const GLOBAL_K = 8;

export const createChat = async (req: Request, res: Response) => {
  try {
    const parsed = createChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          issue: parsed.error.issues[0]?.path[0],
          message: parsed.error.issues[0]?.message,
        },
      });
    }

    const userId = req.user!.id;
    const { title, documentId } = parsed.data;

    // if scoped to a document, verify ownership
    if (documentId) {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { userId: true, status: true },
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (document.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (document.status !== "COMPLETED") {
        return res.status(400).json({ error: "Document is not ready yet" });
      }
    }

    const chat = await prisma.chat.create({
      data: {
        userId,
        title: title ?? null,
        documentId: documentId ?? null,
      },
      select: {
        id: true,
        title: true,
        documentId: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ chat });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const listChats = async (req: Request, res: Response) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        documentId: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    return res.json({ chats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const getChat = async (req: Request, res: Response) => {
  try {
    const chatId = req.params.id as string;
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        title: true,
        documentId: true,
        createdAt: true,
        userId: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            sources: true,
            createdAt: true,
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    if (chat.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { userId: _, ...resChat } = chat;
    return res.json({ chat: resChat });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const deleteChat = async (req: Request, res: Response) => {
  try {
    const chatId = req.params.id as string;
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true },
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    if (chat.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.chat.delete({ where: { id: chatId } });
    return res.json({ message: "Chat deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const chatId = req.params.id as string;
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          issue: parsed.error.issues[0]?.path[0],
          message: parsed.error.issues[0]?.message,
        },
      });
    }

    const userId = req.user!.id;
    const { message } = parsed.data;

    // verify chat ownership
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        userId: true,
        documentId: true,
        messages: {
          orderBy: { createdAt: "asc" },
          take: 10,
          select: { role: true, content: true },
        },
      },
    });

    if (!chat) return res.status(404).json({ error: "Chat not found" });
    if (chat.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    // embed the user message
    const queryEmbedding = await embedQuery(message);

    // similarity search
    const limit = chat.documentId ? SCOPED_K : GLOBAL_K;
    const similarChunks = await searchSimilarChunks(
      queryEmbedding,
      userId,
      limit,
      chat.documentId ?? undefined
    );

    if (similarChunks.length === 0) {
      return res.status(400).json({
        error: "No relevant content found. Add some documents first.",
      });
    }

    // build context from chunks
    const context = similarChunks
      .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
      .join("\n\n");

    // build sources for citation
    const sources = similarChunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      documentType: chunk.documentType,
      sourceUrl: chunk.sourceUrl,
      similarity: Math.round(chunk.similarity * 100) / 100,
    }));

    // build conversation history
    const history = chat.messages.reverse().map((m) => ({
      role: m.role.toLowerCase() as "user" | "assistant",
      content: m.content,
    }));

    // save user message first
    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "USER",
        content: message,
      },
    });

    // set SSE headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // stream response from OpenAI
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant for a personal knowledge base.
          Answer questions based on the provided context.
          You must answer only from the provided context and conversation history.
          If the context does not contain enough information, say so.
          When possible, base the answer on the numbered context chunks.
          Context:
          ${context}`,
        },
        ...history,
        { role: "user", content: message },
      ],
      max_tokens: 1000,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        fullResponse += delta;
        // send each token as SSE event
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    // signal stream end
    res.write(`data: ${JSON.stringify({ done: true, sources })}\n\n`);
    res.end();

    // save assistant response to DB
    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "ASSISTANT",
        content: fullResponse,
        sources: sources,
      },
    });

    // update chat updatedAt
    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

  } catch (err) {
    console.error(err);
    // if headers already sent we can't send JSON error
    if (!res.headersSent) {
      return res.status(500).json({ error: "Something went wrong" });
    }
    res.write(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`);
    res.end();
  }
};