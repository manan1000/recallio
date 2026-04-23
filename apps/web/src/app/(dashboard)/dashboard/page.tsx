"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { documentsApi, chatsApi } from "@/lib/api";
import { FileText, MessageSquare, Plus, Search, Clock, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { Document, Chat, DocumentStatus } from "@repo/types";

// maps each document status to a badge color
// so COMPLETED is green, FAILED is red, etc.
const statusConfig: Record<DocumentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    COMPLETED: { label: "Ready", variant: "default" },
    PROCESSING: { label: "Processing", variant: "secondary" },
    PENDING: { label: "Pending", variant: "outline" },
    FAILED: { label: "Failed", variant: "destructive" },
};

// maps each document type to a readable label
const typeLabel: Record<string, string> = {
    LINK: "Link",
    YOUTUBE: "YouTube",
    NOTE: "Note",
    PDF: "PDF",
    IMAGE: "Image",
    DOCUMENT: "Document",
};

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();

    // fetch documents — TanStack Query handles loading, error, and caching
    const {
        data: documentsData,
        isLoading: documentsLoading,
    } = useQuery({
        queryKey: ["documents"],
        queryFn: () => documentsApi.list(1, 6), // first page, 6 documents
    });

    // fetch chats separately — independent loading state
    const {
        data: chatsData,
        isLoading: chatsLoading,
    } = useQuery({
        queryKey: ["chats"],
        queryFn: () => chatsApi.list(),
    });

    const documents = documentsData?.documents ?? [];
    const chats = chatsData?.chats?.slice(0, 5) ?? [];
    const hasDocuments = documents.length > 0;

    const handleNewChat = async () => {
        router.push("/chat");
    };

    return (
        <div className="space-y-8">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {/* greet user by first name if available */}
                        Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {hasDocuments
                            ? "Here's what's in your knowledge base."
                            : "Let's build your knowledge base."}
                    </p>
                </div>

                {/* quick action buttons — only show if user has documents */}
                {hasDocuments && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/search">
                                <Search className="h-4 w-4 mr-1" />
                                Search
                            </Link>
                        </Button>
                        <Button onClick={handleNewChat}>
                            <MessageSquare className="h-4 w-4 mr-1" />
                            New Chat
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Empty State ── */}
            {/* shown when user has no documents and we're not loading */}
            {!documentsLoading && !hasDocuments && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
                    <div className="rounded-full bg-primary/10 p-4 mb-4">
                        <FileText className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">
                        Your knowledge base is empty
                    </h2>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                        Add your first document — a link, YouTube video, note, or file —
                        and start chatting with your knowledge base.
                    </p>
                    <Button asChild size="lg">
                        <Link href="/documents">
                            <Plus className="h-4 w-4" />
                            Add your first document
                        </Link>
                    </Button>
                </div>
            )}

            {/* ── Recent Documents ── */}
            {(documentsLoading || hasDocuments) && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Recent Documents</h2>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/documents">View all</Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {/* show skeleton cards while loading */}
                        {documentsLoading &&
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="rounded-lg border p-4 space-y-3">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                    <Skeleton className="h-3 w-full" />
                                </div>
                            ))}

                        {/* render actual document cards */}
                        {!documentsLoading &&
                            documents.map((doc: Document) => {
                                const status = statusConfig[doc.status];
                                return (
                                    <Link
                                        key={doc.id}
                                        href={`/documents/${doc.id}`}
                                        className="group rounded-lg border p-4 space-y-3 hover:border-primary/50 hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="font-medium text-sm leading-snug line-clamp-2">
                                                {/* use title if available, fall back to URL or "Untitled" */}
                                                {doc.title ?? doc.sourceUrl ?? doc.fileName ?? "Untitled"}
                                            </p>
                                            <Badge variant={status.variant} className="shrink-0 text-xs">
                                                {status.label}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="bg-secondary px-1.5 py-0.5 rounded text-xs">
                                                {typeLabel[doc.type]}
                                            </span>
                                            <span>·</span>
                                            <span>
                                                {/* format the date nicely e.g. "Apr 22, 2026" */}
                                                {new Date(doc.createdAt).toLocaleDateString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </span>
                                        </div>

                                        {/* show summary if available and document is completed */}
                                        {doc.summary && doc.status === "COMPLETED" && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {doc.summary}
                                            </p>
                                        )}

                                        {/* show error if failed */}
                                        {doc.status === "FAILED" && (
                                            <div className="flex items-center gap-1 text-xs text-destructive">
                                                <AlertCircle className="h-3 w-3" />
                                                <span>Processing failed</span>
                                            </div>
                                        )}

                                        {/* show processing indicator */}
                                        {(doc.status === "PROCESSING" || doc.status === "PENDING") && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                <span>Processing...</span>
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                    </div>
                </section>
            )}

            {/* ── Recent Chats ── */}
            {(chatsLoading || chats.length > 0) && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Recent Chats</h2>
                        <Button variant="ghost" size="sm" onClick={handleNewChat}>
                            New Chat
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {/* skeleton loading state */}
                        {chatsLoading &&
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-lg border p-4 flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-2/3" />
                                    </div>
                                </div>
                            ))}

                        {/* render actual chats */}
                        {!chatsLoading &&
                            chats.map((chat: Chat) => {
                                const lastMessage = chat.messages?.[0];
                                const chatLabel = chat.title ?? "Untitled Chat";

                                return (
                                    <Link
                                        key={chat.id}
                                        href={`/chat/${chat.id}`}
                                        className="flex items-center gap-3 rounded-lg border p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="rounded-full bg-primary/10 p-2 shrink-0">
                                            <MessageSquare className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{chatLabel}</p>
                                            {lastMessage && (
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                    {lastMessage.content.slice(0, 60)}
                                                    {lastMessage.content.length > 60 ? "..." : ""}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                                {new Date(chat.updatedAt).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                    </div>
                </section>
            )}
        </div>
    );
}