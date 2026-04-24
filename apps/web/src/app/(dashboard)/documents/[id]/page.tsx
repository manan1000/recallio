"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { documentsApi, ApiError } from "@/lib/api";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
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
    ArrowLeft,
    ExternalLink,
    MessageSquare,
    Download,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Clock,
    Trash2,
    Pencil,
} from "lucide-react";
import Link from "next/link";
import type { DocumentStatus } from "@repo/types";
import { toast } from "sonner";

const statusConfig: Record<
    DocumentStatus,
    {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
        icon: React.ReactNode;
    }
> = {
    COMPLETED: {
        label: "Ready",
        variant: "default",
        icon: <CheckCircle2 className="h-3 w-3" />,
    },
    PROCESSING: {
        label: "Processing",
        variant: "secondary",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    PENDING: {
        label: "Pending",
        variant: "outline",
        icon: <Clock className="h-3 w-3" />,
    },
    FAILED: {
        label: "Failed",
        variant: "destructive",
        icon: <AlertCircle className="h-3 w-3" />,
    },
};

const typeLabel: Record<string, string> = {
    LINK: "Link",
    YOUTUBE: "YouTube",
    NOTE: "Note",
    PDF: "PDF",
    IMAGE: "Image",
    DOCUMENT: "Document",
};

export default function DocumentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ["document", id],
        queryFn: () => documentsApi.get(id),
    });


    useQuery({
        queryKey: ["document", id, "status"],
        queryFn: () => documentsApi.getStatus(id),
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "COMPLETED" || status === "FAILED" ? false : 2000;
        },
        enabled:
            data?.document.status === "PENDING" ||
            data?.document.status === "PROCESSING",
        select: (statusData) => {
            if (statusData.status === "COMPLETED" || statusData.status === "FAILED") {
                queryClient.invalidateQueries({ queryKey: ["document", id] });
                queryClient.invalidateQueries({ queryKey: ["documents"] });
            }
            return statusData;
        },
    });

    const { mutate: deleteDocument, isPending: isDeleting } = useMutation({
        mutationFn: () => documentsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            toast.success("Document deleted");
            router.push("/documents");
        },
        onError: () => {
            toast.error("Failed to delete document");
        },
    });

    const handleStartChat = () => {
        router.push(`/chat?documentId=${id}`);
    };

    const handleDownload = async () => {
        const result = await documentsApi.download(id);
        window.open(result.downloadUrl, "_blank");
    };

    if (isLoading) {
        return (
            <div className="px-4 py-6 sm:px-6 space-y-4 max-w-3xl mx-auto">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (error || !data?.document) {
        return (
            <div className="px-4 py-6 sm:px-6 flex flex-col items-center justify-center min-h-[400px] text-center">
                <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                <p className="font-medium">Document not found</p>
                <p className="text-muted-foreground text-sm mt-1">
                    This document may have been deleted.
                </p>
                <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => router.push("/documents")}
                >
                    Back to Documents
                </Button>
            </div>
        );
    }

    const document = data.document;
    const status = statusConfig[document.status];
    const isCompleted = document.status === "COMPLETED";
    const isFileType =
        document.type === "PDF" ||
        document.type === "IMAGE" ||
        document.type === "DOCUMENT";

    return (
        <div className="px-4 py-6 sm:px-6 max-w-3xl mx-auto space-y-6">

            {/* back button + title row */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="shrink-0" asChild>
                    <Link href="/documents">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="font-semibold text-lg leading-tight flex-1 min-w-0 truncate">
                    {document.title ?? "Untitled"}
                </h1>
            </div>

            {/* metadata row — type badge, status badge, date */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="bg-secondary px-2 py-0.5 rounded text-xs font-medium">
                    {typeLabel[document.type]}
                </span>
                <Badge
                    variant={status.variant}
                    className="text-xs flex items-center gap-1"
                >
                    {status.icon}
                    {status.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                    Added{" "}
                    {new Date(document.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                    })}
                </span>
            </div>

            {/* action buttons — stack on mobile, row on desktop */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {isCompleted && (
                    <Button size="sm" className="w-full sm:w-auto" onClick={handleStartChat}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat about this
                    </Button>
                )}
                {document.sourceUrl && (
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                        <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open source
                        </a>
                    </Button>
                )}
                {isFileType && document.fileName && (
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                    </Button>
                )}
                {document.type === "NOTE" && (
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                        <Link href={`/documents/${id}/edit`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit note
                        </Link>
                    </Button>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full sm:w-auto sm:ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                </Button>
            </div>

            {/* source URL */}
            {
                document.sourceUrl && (
                    <div className="rounded-lg border p-4 space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Source
                        </p>
                        <a
                            href={document.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline break-all"
                        >
                            {document.sourceUrl}
                        </a>
                    </div >
                )
            }

            {/* file name */}
            {
                document.fileName && (
                    <div className="rounded-lg border p-4 space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            File
                        </p>
                        <p className="text-sm">{document.fileName}</p>
                    </div>
                )
            }

            {/* error state */}
            {
                document.status === "FAILED" && document.error && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 flex items-start gap-3">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-destructive">
                                Processing failed
                            </p>
                            <p className="text-xs text-destructive/80 mt-1">
                                {document.error}
                            </p>
                        </div>
                    </div>
                )
            }

            {/* processing state */}
            {
                (document.status === "PENDING" ||
                    document.status === "PROCESSING") && (
                    <div className="rounded-lg border p-4 flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        This document is being processed. Check back shortly.
                    </div>
                )
            }

            {/* summary */}
            {
                document.summary && isCompleted && (
                    <div className="rounded-lg border p-4 space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Summary
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {document.summary}
                        </p>
                    </div>
                )
            }

            {/* note content */}
            {
                document.type === "NOTE" && document.content && (
                    <div className="rounded-lg border p-4 space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Content
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {document.content}
                        </p>
                    </div>
                )
            }

            {/* ready to explore CTA */}
            {
                isCompleted && (
                    <div className="rounded-lg border border-dashed p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                        <MessageSquare className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                            <p className="font-medium text-sm">Ready to explore</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                This document has been processed and is ready to chat with or
                                search.
                            </p>
                        </div>
                        <Button onClick={handleStartChat} size="sm" className="shrink-0">
                            Start a conversation
                        </Button>
                    </div>
                )
            }

            {/* delete confirmation dialog */}
            <AlertDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
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
                            onClick={() => deleteDocument()}
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
        </div >
    );
}