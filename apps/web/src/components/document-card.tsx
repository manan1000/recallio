"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { documentsApi } from "@/lib/api";
import type { Document, DocumentStatus } from "@repo/types";
import { Badge } from "@repo/ui/components/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
    MoreHorizontal,
    Trash2,
    ExternalLink,
    MessageSquare,
    Pencil,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Clock,
} from "lucide-react";

const statusConfig: Record<DocumentStatus, {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
}> = {
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

export function DocumentCard({
    doc,
    onDelete,
    onEdit,
}: {
    doc: Document;
    onDelete: (id: string) => void;
    onEdit: (doc: Document) => void;
}) {
    const router = useRouter();
    const queryClient = useQueryClient();

    useQuery({
        queryKey: ["document", doc.id, "status"],
        queryFn: () => documentsApi.getStatus(doc.id),
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "COMPLETED" || status === "FAILED" ? false : 1000;
        },
        enabled: doc.status === "PENDING" || doc.status === "PROCESSING",
        select: (data) => {
            if (data.status === "COMPLETED" || data.status === "FAILED") {
                queryClient.invalidateQueries({ queryKey: ["documents"] });
            }
            return data;
        },
    });

    const status = statusConfig[doc.status];
    const isCompleted = doc.status === "COMPLETED";
    const displayTitle = doc.title ?? doc.sourceUrl ?? doc.fileName ?? "Untitled";

    const handleStartChat = () => {
        router.push(`/chat?documentId=${doc.id}`);
    };

    return (
        <div className="group relative rounded-lg border bg-card p-4 space-y-3 hover:border-primary/50 transition-colors">
            <div className="absolute top-3 right-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Document options"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        {isCompleted && (
                            <DropdownMenuItem onClick={handleStartChat}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Chat about this
                            </DropdownMenuItem>
                        )}
                        {(doc.type === "LINK" || doc.type === "YOUTUBE") && doc.sourceUrl && (
                            <DropdownMenuItem asChild>
                                <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open source
                                </a>
                            </DropdownMenuItem>
                        )}
                        {doc.type === "NOTE" && (
                            <DropdownMenuItem onClick={() => onEdit(doc)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit note
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete(doc.id)}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Link href={`/documents/${doc.id}`} className="block space-y-3">
                <div className="flex items-start gap-2 pr-6">
                    <p className="font-medium text-sm leading-snug line-clamp-2 flex-1">
                        {displayTitle}
                    </p>
                    <Badge
                        variant={status.variant}
                        className="shrink-0 text-xs flex items-center gap-1"
                    >
                        {status.icon}
                        {status.label}
                    </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="bg-secondary px-1.5 py-0.5 rounded text-xs">
                        {typeLabel[doc.type]}
                    </span>
                    <span>·</span>
                    <span>
                        {new Date(doc.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}
                    </span>
                    {doc.sourceUrl && (
                        <>
                            <span>·</span>
                            <ExternalLink className="h-3 w-3" />
                        </>
                    )}
                </div>

                {doc.summary && isCompleted && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {doc.summary}
                    </p>
                )}

                {doc.status === "FAILED" && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Processing failed. Try adding it again.
                    </p>
                )}
            </Link>
        </div>
    );
}