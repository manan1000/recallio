"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatsApi } from "@/lib/api";
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
import { MessageSquare, Trash2, Clock, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Chat } from "@repo/types";
import { toast } from "sonner";

export default function ChatsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["chats"],
        queryFn: () => chatsApi.list(),
    });

    const { mutate: deleteChat, isPending: isDeleting } = useMutation({
        mutationFn: (id: string) => chatsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["chats"] });
            setDeleteId(null);
            toast.success("Chat deleted");
        },
        onError: () => {
            toast.error("Failed to delete chat");
        },
    });

    const chats = data?.chats ?? [];

    return (
        <div className="px-4 py-6 sm:px-6 space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Chats</h1>
                    <p className="text-muted-foreground mt-1">
                        {chats.length} conversation{chats.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <Button onClick={() => router.push("/chat")}>
                    <Plus className="h-4 w-4" />
                    New Chat
                </Button>
            </div>

            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="rounded-lg border p-4 flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && chats.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="font-medium">No chats yet</p>
                    <p className="text-muted-foreground text-sm mt-1 mb-4">
                        Start a conversation with your knowledge base
                    </p>
                    <Button onClick={() => router.push("/chat")}>
                        <Plus className="h-4 w-4" />
                        New Chat
                    </Button>
                </div>
            )}

            {!isLoading && chats.length > 0 && (
                <div className="space-y-2">
                    {chats.map((chat: Chat) => {
                        const lastMessage = chat.messages?.[0];
                        const chatLabel = chat.title ?? "Untitled Chat";

                        return (
                            <div
                                key={chat.id}
                                className="group flex items-center gap-3 rounded-lg border p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors"
                            >
                                <div className="rounded-full bg-primary/10 p-2 shrink-0">
                                    <MessageSquare className="h-4 w-4 text-primary" />
                                </div>

                                <Link
                                    href={`/chat/${chat.id}`}
                                    className="flex-1 min-w-0"
                                >
                                    <p className="font-medium text-sm truncate">{chatLabel}</p>
                                    {lastMessage && (
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {lastMessage.content.slice(0, 80)}
                                            {lastMessage.content.length > 80 ? "..." : ""}
                                        </p>
                                    )}
                                </Link>

                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {new Date(chat.updatedAt).toLocaleDateString("en-IN", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </div>
                                    <button
                                        onClick={() => setDeleteId(chat.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                                        aria-label="Delete chat"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <AlertDialog
                open={!!deleteId}
                onOpenChange={(o) => { if (!o) setDeleteId(null); }}
            >
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
                            onClick={() => deleteId && deleteChat(deleteId)}
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