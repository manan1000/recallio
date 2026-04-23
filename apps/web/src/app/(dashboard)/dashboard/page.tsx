"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { documentsApi, chatsApi } from "@/lib/api";
import { DocumentCard } from "@/components/document-card";
import type { Document, Chat } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
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
import {
    FileText,
    MessageSquare,
    Plus,
    Search,
    Clock,
    Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    // state for the delete confirmation dialog
    // same pattern as the documents page — deleteId drives the dialog open/close
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // the dashboard shows the 6 most recent documents — enough for a quick overview
    const { data: documentsData, isLoading: documentsLoading } = useQuery({
        queryKey: ["documents"],
        queryFn: () => documentsApi.list(1, 6),
    });

    const { data: chatsData, isLoading: chatsLoading } = useQuery({
        queryKey: ["chats"],
        queryFn: () => chatsApi.list(),
    });

    const documents = documentsData?.documents ?? [];
    const chats = chatsData?.chats?.slice(0, 5) ?? [];
    const hasDocuments = documents.length > 0;

    const { mutate: deleteDocument, isPending: isDeleting } = useMutation({
        mutationFn: (id: string) => documentsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            setDeleteId(null);
        },
    });

    return (
        <div className="space-y-8">

            {/* header with greeting and quick action buttons */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {hasDocuments
                            ? "Here's what's in your knowledge base."
                            : "Let's build your knowledge base."}
                    </p>
                </div>

                {hasDocuments && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/search">
                                <Search className="h-4 w-4 mr-2" />
                                Search
                            </Link>
                        </Button>
                        <Button onClick={() => router.push("/chat")}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            New Chat
                        </Button>
                    </div>
                )}
            </div>

            {/* empty state — only when loading is done and no documents exist */}
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

            {/* recent documents section */}
            {(documentsLoading || hasDocuments) && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Recent Documents</h2>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/documents">View all</Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {documentsLoading &&
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="rounded-lg border p-4 space-y-3">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                    <Skeleton className="h-3 w-full" />
                                </div>
                            ))}

                        {/* DocumentCard handles its own polling, menu, and navigation */}
                        {!documentsLoading &&
                            documents.map((doc: Document) => (
                                <DocumentCard
                                    key={doc.id}
                                    doc={doc}
                                    onDelete={(id) => setDeleteId(id)}
                                    // edit is handled on the documents page — dashboard just redirects
                                    onEdit={(doc) => router.push(`/documents/${doc.id}`)}
                                />
                            ))}
                    </div>
                </section>
            )}

            {/* recent chats section */}
            {(chatsLoading || chats.length > 0) && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Recent Chats</h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/chat")}
                        >
                            New Chat
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {chatsLoading &&
                            Array.from({ length: 3 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="rounded-lg border p-4 flex items-center gap-3"
                                >
                                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-2/3" />
                                    </div>
                                </div>
                            ))}

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

            {/* delete confirmation dialog — same pattern as documents page */}
            <AlertDialog
                open={!!deleteId}
                onOpenChange={(o) => { if (!o) setDeleteId(null); }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes the document and all its embeddings
                            from your knowledge base. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteId && deleteDocument(deleteId)}
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