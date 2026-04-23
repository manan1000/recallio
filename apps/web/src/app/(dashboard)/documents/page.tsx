"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi } from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { Document, DocumentStatus } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@repo/ui/components/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Field, FieldLabel, FieldError, FieldGroup } from "@repo/ui/components/field";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Plus,
    Trash2,
    ExternalLink,
    FileText,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Clock,
} from "lucide-react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Status configuration
// tells us what color badge and icon to show for each status
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Zod schemas for each document type
// using discriminated union so each tab has its own validation
// ─────────────────────────────────────────────

const linkSchema = z.object({
    type: z.literal("LINK"),
    url: z.string().trim().url("Please enter a valid URL"),
    title: z.string().trim().min(1).optional(),
});

const youtubeSchema = z.object({
    type: z.literal("YOUTUBE"),
    url: z.string().trim().url("Please enter a valid URL").refine(
        (url) => {
            try {
                const { hostname } = new URL(url);
                return ["youtube.com", "www.youtube.com", "youtu.be"].includes(hostname);
            } catch { return false; }
        },
        "Please enter a valid YouTube URL"
    ),
    title: z.string().trim().min(1).optional(),
});

const noteSchema = z.object({
    type: z.literal("NOTE"),
    content: z.string().trim().min(1, "Note content cannot be empty"),
    title: z.string().trim().min(1).optional(),
});

// ─────────────────────────────────────────────
// Add Document Dialog
// separated into its own component to keep the page clean
// ─────────────────────────────────────────────

function AddDocumentDialog({
    open,
    onClose,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [activeTab, setActiveTab] = useState<"LINK" | "YOUTUBE" | "NOTE">("LINK");
    const [serverError, setServerError] = useState<string | null>(null);

    // we use separate forms for each tab since they have different schemas
    // this keeps validation clean and independent
    const linkForm = useForm({ resolver: zodResolver(linkSchema), defaultValues: { type: "LINK" as const, url: "", title: "" } });
    const youtubeForm = useForm({ resolver: zodResolver(youtubeSchema), defaultValues: { type: "YOUTUBE" as const, url: "", title: "" } });
    const noteForm = useForm({ resolver: zodResolver(noteSchema), defaultValues: { type: "NOTE" as const, content: "", title: "" } });

    const queryClient = useQueryClient();

    // useMutation for creating a document
    // onSuccess invalidates the documents cache so the list refreshes automatically
    const { mutate: createDocument, isPending } = useMutation({
        mutationFn: documentsApi.create,
        onSuccess: () => {
            // invalidate both the documents list and the dashboard's document list
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            linkForm.reset();
            youtubeForm.reset();
            noteForm.reset();
            setServerError(null);
            onSuccess();
            onClose();
        },
        onError: (err) => {
            if (err instanceof ApiError) {
                setServerError(err.message);
            } else {
                setServerError("Something went wrong. Please try again.");
            }
        },
    });

    const handleLinkSubmit = (values: z.infer<typeof linkSchema>) => {
        setServerError(null);
        createDocument({ type: values.type, url: values.url, ...(values.title && { title: values.title }) });
    };

    const handleYoutubeSubmit = (values: z.infer<typeof youtubeSchema>) => {
        setServerError(null);
        createDocument({ type: values.type, url: values.url, ...(values.title && { title: values.title }) });
    };

    const handleNoteSubmit = (values: z.infer<typeof noteSchema>) => {
        setServerError(null);
        createDocument({ type: values.type, content: values.content, ...(values.title && { title: values.title }) });
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add to Knowledge Base</DialogTitle>
                    <DialogDescription>
                        Add a link, YouTube video, or note to your knowledge base.
                    </DialogDescription>
                </DialogHeader>

                {serverError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {serverError}
                    </div>
                )}

                {/* tabs let users switch between the three document types
            each tab has its own form with its own validation */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                    <TabsList className="w-full">
                        <TabsTrigger value="LINK" className="flex-1">Link</TabsTrigger>
                        <TabsTrigger value="YOUTUBE" className="flex-1">YouTube</TabsTrigger>
                        <TabsTrigger value="NOTE" className="flex-1">Note</TabsTrigger>
                    </TabsList>

                    {/* Link tab */}
                    <TabsContent value="LINK">
                        <form onSubmit={linkForm.handleSubmit(handleLinkSubmit)} className="space-y-4 pt-2">
                            <FieldGroup>
                                <Controller
                                    name="url"
                                    control={linkForm.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="link-url">URL</FieldLabel>
                                            <Input
                                                {...field}
                                                id="link-url"
                                                placeholder="https://example.com/article"
                                                disabled={isPending}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="title"
                                    control={linkForm.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="link-title">Title <span className="text-muted-foreground">(optional)</span></FieldLabel>
                                            <Input
                                                {...field}
                                                id="link-title"
                                                placeholder="Give it a name..."
                                                disabled={isPending}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Link"}
                            </Button>
                        </form>
                    </TabsContent>

                    {/* YouTube tab */}
                    <TabsContent value="YOUTUBE">
                        <form onSubmit={youtubeForm.handleSubmit(handleYoutubeSubmit)} className="space-y-4 pt-2">
                            <FieldGroup>
                                <Controller
                                    name="url"
                                    control={youtubeForm.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="yt-url">YouTube URL</FieldLabel>
                                            <Input
                                                {...field}
                                                id="yt-url"
                                                placeholder="https://youtube.com/watch?v=..."
                                                disabled={isPending}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="title"
                                    control={youtubeForm.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="yt-title">Title <span className="text-muted-foreground">(optional)</span></FieldLabel>
                                            <Input
                                                {...field}
                                                id="yt-title"
                                                placeholder="Give it a name..."
                                                disabled={isPending}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Video"}
                            </Button>
                        </form>
                    </TabsContent>

                    {/* Note tab */}
                    <TabsContent value="NOTE">
                        <form onSubmit={noteForm.handleSubmit(handleNoteSubmit)} className="space-y-4 pt-2">
                            <FieldGroup>
                                <Controller
                                    name="title"
                                    control={noteForm.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="note-title">Title <span className="text-muted-foreground">(optional)</span></FieldLabel>
                                            <Input
                                                {...field}
                                                id="note-title"
                                                placeholder="Give it a name..."
                                                disabled={isPending}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                                <Controller
                                    name="content"
                                    control={noteForm.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="note-content">Content</FieldLabel>
                                            <Textarea
                                                {...field}
                                                id="note-content"
                                                placeholder="Write your note here..."
                                                rows={5}
                                                disabled={isPending}
                                                aria-invalid={fieldState.invalid}
                                                className="resize-none"
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Note"}
                            </Button>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────
// Document Card
// each document in the grid is its own component
// it handles its own status polling independently
// ─────────────────────────────────────────────

function DocumentCard({
    doc,
    onDelete,
}: {
    doc: Document;
    onDelete: (id: string) => void;
}) {
    // poll status every 3 seconds if the document is still being processed
    // when it reaches COMPLETED or FAILED, polling stops automatically
    // this is the "optimistic polling" pattern — the UI updates itself
    useQuery({
        queryKey: ["document", doc.id, "status"],
        queryFn: () => documentsApi.getStatus(doc.id),
        // refetchInterval can be a function that receives the latest data
        // returning false stops polling, returning a number continues it
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "COMPLETED" || status === "FAILED" ? false : 3000;
        },
        // only poll if the document isn't already done
        enabled: doc.status === "PENDING" || doc.status === "PROCESSING",
    });

    const status = statusConfig[doc.status];
    const displayTitle = doc.title ?? doc.sourceUrl ?? doc.fileName ?? "Untitled";

    return (
        <div className="group relative rounded-lg border bg-card p-4 space-y-3 hover:border-primary/50 transition-colors">
            {/* delete button — only visible on hover */}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    onDelete(doc.id);
                }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                aria-label="Delete document"
            >
                <Trash2 className="h-4 w-4" />
            </button>

            <Link href={`/documents/${doc.id}`} className="block space-y-3">
                {/* title and status badge */}
                <div className="flex items-start gap-2 pr-6">
                    <p className="font-medium text-sm leading-snug line-clamp-2 flex-1">
                        {displayTitle}
                    </p>
                    <Badge variant={status.variant} className="shrink-0 text-xs flex items-center gap-1">
                        {status.icon}
                        {status.label}
                    </Badge>
                </div>

                {/* type badge and date */}
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
                    {/* show external link icon for URL-based documents */}
                    {doc.sourceUrl && (
                        <>
                            <span>·</span>
                            <ExternalLink className="h-3 w-3" />
                        </>
                    )}
                </div>

                {/* summary if available */}
                {doc.summary && doc.status === "COMPLETED" && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {doc.summary}
                    </p>
                )}

                {/* error message if failed */}
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

// ─────────────────────────────────────────────
// Main Documents Page
// ─────────────────────────────────────────────

export default function DocumentsPage() {
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const queryClient = useQueryClient();

    // fetch paginated documents
    const { data, isLoading } = useQuery({
        queryKey: ["documents", page],
        queryFn: () => documentsApi.list(page, 12), // 12 per page fits a 3-column grid nicely
    });

    const documents = data?.documents ?? [];
    const pagination = data?.pagination;

    // mutation for deleting a document
    const { mutate: deleteDocument, isPending: isDeleting } = useMutation({
        mutationFn: (id: string) => documentsApi.delete(id),
        onSuccess: () => {
            // invalidate all document queries so the list refreshes
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            setDeleteId(null);
        },
    });

    return (
        <div className="space-y-6">
            {/* ── Page Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
                    <p className="text-muted-foreground mt-1">
                        {pagination
                            ? `${pagination.total} item${pagination.total !== 1 ? "s" : ""} in your knowledge base`
                            : "Your knowledge base"}
                    </p>
                </div>
                <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Document
                </Button>
            </div>

            {/* ── Empty State ── */}
            {!isLoading && documents.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
                    <div className="rounded-full bg-primary/10 p-4 mb-4">
                        <FileText className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No documents yet</h2>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                        Add links, YouTube videos, or notes to start building your knowledge base.
                    </p>
                    <Button onClick={() => setAddDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add your first document
                    </Button>
                </div>
            )}

            {/* ── Document Grid ── */}
            {(isLoading || documents.length > 0) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* skeleton cards while loading */}
                    {isLoading &&
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-lg border p-4 space-y-3">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        ))}

                    {/* actual document cards */}
                    {!isLoading &&
                        documents.map((doc: Document) => (
                            <DocumentCard
                                key={doc.id}
                                doc={doc}
                                onDelete={(id) => setDeleteId(id)}
                            />
                        ))}
                </div>
            )}

            {/* ── Pagination ── */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p - 1)}
                        disabled={page === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {page} of {pagination.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page === pagination.totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* ── Add Document Dialog ── */}
            <AddDocumentDialog
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
                onSuccess={() => {
                    // navigate to page 1 after adding so the new document is visible
                    setPage(1);
                }}
            />

            {/* ── Delete Confirmation Dialog ── */}
            {/* AlertDialog is different from Dialog — it's designed for destructive actions
          it forces the user to make an explicit choice before proceeding */}
            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the document and all its chunks from your
                            knowledge base. This action cannot be undone.
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
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</>
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