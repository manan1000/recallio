"use client";

import { useState, useRef, useEffect, use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatsApi, ApiError } from "@/lib/api";
import type { Message, Source } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Badge } from "@repo/ui/components/badge";
import {
    Send,
    Bot,
    User,
    ExternalLink,
    Loader2,
    AlertCircle,
    Trash2,
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ChatPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: chatId } = use(params);
    const queryClient = useQueryClient();
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingContent, setStreamingContent] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [input, setInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [sources, setSources] = useState<Source[]>([]);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { data: chatData, isLoading } = useQuery({
        queryKey: ["chat", chatId],
        queryFn: () => chatsApi.get(chatId),
    });

    useEffect(() => {
        if (chatData?.chat.messages) {
            setMessages(chatData.chat.messages);
        }
    }, [chatData]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingContent]);

    const { mutate: deleteChat, isPending: isDeleting } = useMutation({
        mutationFn: () => chatsApi.delete(chatId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["chats"] });
            toast.success("Chat deleted");
            router.replace("/chat");
        },
        onError: () => {
            toast.error("Failed to delete chat");
        },
    });

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || isStreaming) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "USER",
            content: trimmed,
            sources: null,
            createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setStreamingContent("");
        setSources([]);
        setError(null);
        setIsStreaming(true);

        try {
            const response = await chatsApi.sendMessage(chatId, trimmed);
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split("\n");

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const parsed = JSON.parse(jsonStr);

                        if (parsed.delta) {
                            fullContent += parsed.delta;
                            setStreamingContent(fullContent);
                        }

                        if (parsed.done) {
                            setSources(parsed.sources ?? []);
                            const assistantMessage: Message = {
                                id: crypto.randomUUID(),
                                role: "ASSISTANT",
                                content: fullContent,
                                sources: parsed.sources ?? null,
                                createdAt: new Date().toISOString(),
                            };
                            setMessages((prev) => [...prev, assistantMessage]);
                            setStreamingContent("");
                            queryClient.invalidateQueries({ queryKey: ["chats"] });
                        }

                        if (parsed.error) {
                            setError(parsed.error);
                        }
                    } catch {
                        // skip malformed JSON lines
                    }
                }
            }
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : "Something went wrong. Please try again."
            );
        } finally {
            setIsStreaming(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full flex-col gap-4 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="border-b px-6 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="font-semibold text-sm truncate">
                        {chatData?.chat.title ?? "New Chat"}
                    </h1>
                    {chatData?.chat.documentId && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Scoped to one document
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    aria-label="Delete chat"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {messages.length === 0 && !isStreaming && (
                    <div className="flex h-full items-center justify-center">
                        <div className="text-center space-y-2">
                            <Bot className="h-10 w-10 text-muted-foreground mx-auto" />
                            <p className="text-sm text-muted-foreground">
                                Ask anything about your knowledge base
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                ))}

                {isStreaming && streamingContent && (
                    <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">
                                Assistant
                            </p>
                            <div className="rounded-lg bg-muted px-4 py-3 text-sm whitespace-pre-wrap">
                                {streamingContent}
                                <span className="inline-block w-1.5 h-4 bg-foreground ml-0.5 animate-pulse" />
                            </div>
                        </div>
                    </div>
                )}

                {isStreaming && !streamingContent && (
                    <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Thinking...
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="border-t px-6 py-4">
                <div className="flex gap-2 items-end">
                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
                        rows={1}
                        disabled={isStreaming}
                        className="resize-none min-h-[44px] max-h-32"
                    />
                    <Button
                        onClick={sendMessage}
                        disabled={!input.trim() || isStreaming}
                        size="icon"
                        className="shrink-0"
                    >
                        {isStreaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    Enter to send · Shift+Enter for new line
                </p>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete chat?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes the chat and all its messages. This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteChat()}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function MessageBubble({ message }: { message: Message }) {
    const isUser = message.role === "USER";

    return (
        <div className="flex gap-3">
            <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-secondary" : "bg-primary/10"
                    }`}
            >
                {isUser ? (
                    <User className="h-4 w-4" />
                ) : (
                    <Bot className="h-4 w-4 text-primary" />
                )}
            </div>

            <div className="flex-1 space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">
                    {isUser ? "You" : "Assistant"}
                </p>

                <div
                    className={`rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${isUser ? "bg-secondary" : "bg-muted"
                        }`}
                >
                    {message.content}
                </div>

                {message.sources && message.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                        {message.sources.map((source, i) => (
                            <Badge
                                key={i}
                                variant="outline"
                                className="text-xs flex items-center gap-1 max-w-[200px]"
                            >
                                {source.sourceUrl ? (
                                    <a
                                        href={source.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 truncate"
                                    >
                                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                        <span className="truncate">
                                            {source.documentTitle ?? "Source"}
                                        </span>
                                    </a>
                                ) : (
                                    <span className="truncate">
                                        {source.documentTitle ?? "Source"}
                                    </span>
                                )}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
}