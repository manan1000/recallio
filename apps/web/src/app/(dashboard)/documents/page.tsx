"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { documentsApi, uploadsApi, ApiError } from "@/lib/api";
import type { Document, DocumentStatus } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Field, FieldLabel, FieldError, FieldGroup } from "@repo/ui/components/field";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import {
    Plus,
    Trash2,
    ExternalLink,
    FileText,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Clock,
    Upload,
    MoreHorizontal,
    MessageSquare,
    Pencil,
} from "lucide-react";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PDF_MIME_TYPES = ["application/pdf"];
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOCUMENT_MIME_TYPES = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// each status maps to a badge color, label, and icon
// this keeps all status-related display logic in one place
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
// Zod schemas
// title is required in all frontend schemas to prevent "Untitled" documents
// the backend still accepts optional titles for programmatic use
// ─────────────────────────────────────────────

const linkSchema = z.object({
    type: z.literal("LINK"),
    url: z.string().trim().url("Please enter a valid URL"),
    title: z.string().trim().min(1, "Please give this document a title"),
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
    title: z.string().trim().min(1, "Please give this document a title"),
});

const noteSchema = z.object({
    type: z.literal("NOTE"),
    content: z.string().trim().min(1, "Note content cannot be empty"),
    title: z.string().trim().min(1, "Please give this note a title"),
});

const fileSchema = z.object({
    title: z.string().trim().min(1, "Please give this document a title"),
    file: z.instanceof(File, { message: "Please select a file" }),
});

type FileForm = z.infer<typeof fileSchema>;

// ─────────────────────────────────────────────
// FileUploadTab
// reused for PDF, IMAGE, and DOCUMENT tabs
// the only difference between them is which MIME types they accept
// ─────────────────────────────────────────────

function FileUploadTab({
    documentType,
    acceptedMimeTypes,
    acceptString,
    isPending,
    uploadState,
    onSubmit,
}: {
    documentType: "PDF" | "IMAGE" | "DOCUMENT";
    acceptedMimeTypes: string[];
    acceptString: string;
    isPending: boolean;
    uploadState: "idle" | "presigning" | "uploading" | "creating";
    onSubmit: (values: FileForm) => void;
}) {
    const form = useForm<FileForm>({
        resolver: zodResolver(fileSchema),
        defaultValues: { title: "", file: undefined as unknown as File },
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // maps the current upload phase to a human-readable label
    // so the user always knows what's happening during the multi-step upload
    const getLabel = () => {
        if (!isPending) return `Add ${documentType === "PDF" ? "PDF" : documentType === "IMAGE" ? "Image" : "Document"}`;
        switch (uploadState) {
            case "presigning": return "Preparing upload...";
            case "uploading": return "Uploading file...";
            case "creating": return "Saving...";
            default: return "Processing...";
        }
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FieldGroup>
                <Controller
                    name="title"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={`${documentType}-title`}>Title</FieldLabel>
                            <Input
                                {...field}
                                id={`${documentType}-title`}
                                placeholder="Give it a name..."
                                disabled={isPending}
                                aria-invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />

                <Controller
                    name="file"
                    control={form.control}
                    render={({ field: { onChange }, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={`${documentType}-file`}>File</FieldLabel>

                            {/* the actual file input is hidden because browsers render it
                  inconsistently — we use a styled label as the visible button */}
                            <input
                                id={`${documentType}-file`}
                                type="file"
                                accept={acceptString}
                                className="hidden"
                                disabled={isPending}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    // validate MIME type client-side before hitting the network
                                    if (!acceptedMimeTypes.includes(file.type)) {
                                        form.setError("file", { message: "File type not supported" });
                                        return;
                                    }
                                    // enforce the same 20MB limit as your Supabase bucket
                                    if (file.size > 20 * 1024 * 1024) {
                                        form.setError("file", { message: "File must be under 20MB" });
                                        return;
                                    }

                                    setSelectedFile(file);
                                    onChange(file);
                                }}
                            />

                            <label
                                htmlFor={`${documentType}-file`}
                                className={[
                                    "flex items-center gap-2 rounded-md border border-dashed p-4 transition-colors",
                                    isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50 hover:bg-accent/50",
                                    fieldState.invalid ? "border-destructive" : "border-input",
                                ].join(" ")}
                            >
                                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm text-muted-foreground truncate">
                                    {selectedFile ? selectedFile.name : "Choose a file..."}
                                </span>
                                {selectedFile && (
                                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                                    </span>
                                )}
                            </label>

                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />
            </FieldGroup>

            <Button type="submit" className="w-full" disabled={isPending}>
                {isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{getLabel()}</>
                    : getLabel()
                }
            </Button>
        </form>
    );
}

// ─────────────────────────────────────────────
// AddDocumentDialog
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
    type TabType = "LINK" | "YOUTUBE" | "NOTE" | "PDF" | "IMAGE" | "DOCUMENT";
    const [activeTab, setActiveTab] = useState<TabType>("LINK");
    const [serverError, setServerError] = useState<string | null>(null);

    // uploadState tracks the three-phase file upload process
    // "idle" means no upload in progress — the other states give
    // the user feedback about what's happening at each step
    const [uploadState, setUploadState] = useState<"idle" | "presigning" | "uploading" | "creating">("idle");

    const isPending = uploadState !== "idle";
    const queryClient = useQueryClient();

    const linkForm = useForm({
        resolver: zodResolver(linkSchema),
        defaultValues: { type: "LINK" as const, url: "", title: "" },
    });
    const youtubeForm = useForm({
        resolver: zodResolver(youtubeSchema),
        defaultValues: { type: "YOUTUBE" as const, url: "", title: "" },
    });
    const noteForm = useForm({
        resolver: zodResolver(noteSchema),
        defaultValues: { type: "NOTE" as const, content: "", title: "" },
    });

    const resetAll = () => {
        linkForm.reset();
        youtubeForm.reset();
        noteForm.reset();
        setServerError(null);
        setUploadState("idle");
    };

    const { mutate: createDocument, isPending: isCreating } = useMutation({
        mutationFn: documentsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            resetAll();
            onSuccess();
            onClose();
        },
        onError: (err) => {
            setUploadState("idle");
            setServerError(err instanceof ApiError ? err.message : "Something went wrong");
        },
    });

    const handleLinkSubmit = (values: z.infer<typeof linkSchema>) => {
        setServerError(null);
        createDocument({ type: values.type, url: values.url, title: values.title });
    };

    const handleYoutubeSubmit = (values: z.infer<typeof youtubeSchema>) => {
        setServerError(null);
        createDocument({ type: values.type, url: values.url, title: values.title });
    };

    const handleNoteSubmit = (values: z.infer<typeof noteSchema>) => {
        setServerError(null);
        createDocument({ type: values.type, content: values.content, title: values.title });
    };

    // file uploads are three sequential async steps — presign, upload, create
    // if any step fails we reset uploadState and show the error to the user
    // we block dialog close during this process to prevent orphaned Supabase files
    const handleFileSubmit = async (
        documentType: "PDF" | "IMAGE" | "DOCUMENT",
        values: FileForm
    ) => {
        setServerError(null);
        const file = values.file;

        try {
            setUploadState("presigning");
            const { uploadUrl, fileUrl, filePath } = await uploadsApi.presign({
                fileName: file.name,
                mimeType: file.type,
                fileSize: file.size,
            });

            setUploadState("uploading");
            await uploadsApi.uploadToStorage(uploadUrl, file);

            setUploadState("creating");
            createDocument({
                type: documentType,
                title: values.title,
                fileUrl,
                filePath,
                fileName: file.name,
                fileSize: file.size,
                // IMAGE requires mimeType in the backend discriminated union schema
                ...(documentType === "IMAGE" && { mimeType: file.type }),
            });
        } catch (err) {
            setUploadState("idle");
            setServerError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
        }
    };

    return (
        // prevent closing during file upload to avoid orphaned Supabase files
        <Dialog open={open} onOpenChange={(o) => { if (!o && !isPending && !isCreating) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add to Knowledge Base</DialogTitle>
                    <DialogDescription>
                        Add a link, YouTube video, note, or file to your knowledge base.
                    </DialogDescription>
                </DialogHeader>

                {serverError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {serverError}
                    </div>
                )}

                {/* prevent tab switching during any async operation */}
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => {
                        if (!isPending && !isCreating) setActiveTab(v as TabType);
                    }}
                >
                    <TabsList className="w-full">
                        <TabsTrigger value="LINK" className="flex-1">Link</TabsTrigger>
                        <TabsTrigger value="YOUTUBE" className="flex-1">YouTube</TabsTrigger>
                        <TabsTrigger value="NOTE" className="flex-1">Note</TabsTrigger>
                        <TabsTrigger value="PDF" className="flex-1">PDF</TabsTrigger>
                        <TabsTrigger value="IMAGE" className="flex-1">Image</TabsTrigger>
                        <TabsTrigger value="DOCUMENT" className="flex-1">Doc</TabsTrigger>
                    </TabsList>

                    <TabsContent value="LINK">
                        <form onSubmit={linkForm.handleSubmit(handleLinkSubmit)} className="space-y-4 pt-2">
                            <FieldGroup>
                                <Controller name="url" control={linkForm.control} render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="link-url">URL</FieldLabel>
                                        <Input {...field} id="link-url" placeholder="https://example.com/article" disabled={isCreating} aria-invalid={fieldState.invalid} />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )} />
                                <Controller name="title" control={linkForm.control} render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="link-title">Title</FieldLabel>
                                        <Input {...field} id="link-title" placeholder="Give it a name..." disabled={isCreating} aria-invalid={fieldState.invalid} />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )} />
                            </FieldGroup>
                            <Button type="submit" className="w-full" disabled={isCreating}>
                                {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Link"}
                            </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="YOUTUBE">
                        <form onSubmit={youtubeForm.handleSubmit(handleYoutubeSubmit)} className="space-y-4 pt-2">
                            <FieldGroup>
                                <Controller name="url" control={youtubeForm.control} render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="yt-url">YouTube URL</FieldLabel>
                                        <Input {...field} id="yt-url" placeholder="https://youtube.com/watch?v=..." disabled={isCreating} aria-invalid={fieldState.invalid} />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )} />
                                <Controller name="title" control={youtubeForm.control} render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="yt-title">Title</FieldLabel>
                                        <Input {...field} id="yt-title" placeholder="Give it a name..." disabled={isCreating} aria-invalid={fieldState.invalid} />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )} />
                            </FieldGroup>
                            <Button type="submit" className="w-full" disabled={isCreating}>
                                {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Video"}
                            </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="NOTE">
                        <form onSubmit={noteForm.handleSubmit(handleNoteSubmit)} className="space-y-4 pt-2">
                            <FieldGroup>
                                <Controller name="title" control={noteForm.control} render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="note-title">Title</FieldLabel>
                                        <Input {...field} id="note-title" placeholder="Give it a name..." disabled={isCreating} aria-invalid={fieldState.invalid} />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )} />
                                <Controller name="content" control={noteForm.control} render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="note-content">Content</FieldLabel>
                                        <Textarea {...field} id="note-content" placeholder="Write your note here..." rows={5} disabled={isCreating} aria-invalid={fieldState.invalid} className="resize-none" />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )} />
                            </FieldGroup>
                            <Button type="submit" className="w-full" disabled={isCreating}>
                                {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Note"}
                            </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="PDF">
                        <FileUploadTab
                            documentType="PDF"
                            acceptedMimeTypes={PDF_MIME_TYPES}
                            acceptString=".pdf"
                            isPending={isPending || isCreating}
                            uploadState={uploadState}
                            onSubmit={(values) => handleFileSubmit("PDF", values)}
                        />
                    </TabsContent>

                    <TabsContent value="IMAGE">
                        <FileUploadTab
                            documentType="IMAGE"
                            acceptedMimeTypes={IMAGE_MIME_TYPES}
                            acceptString=".jpg,.jpeg,.png,.webp,.gif"
                            isPending={isPending || isCreating}
                            uploadState={uploadState}
                            onSubmit={(values) => handleFileSubmit("IMAGE", values)}
                        />
                    </TabsContent>

                    <TabsContent value="DOCUMENT">
                        <FileUploadTab
                            documentType="DOCUMENT"
                            acceptedMimeTypes={DOCUMENT_MIME_TYPES}
                            acceptString=".doc,.docx"
                            isPending={isPending || isCreating}
                            uploadState={uploadState}
                            onSubmit={(values) => handleFileSubmit("DOCUMENT", values)}
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────
// EditNoteDialog
// only shown for NOTE type documents
// fetches the full document to pre-fill the content field
// ─────────────────────────────────────────────

function EditNoteDialog({
    doc,
    onClose,
}: {
    doc: Document | null;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [serverError, setServerError] = useState<string | null>(null);

    // fetch the full document to get cleanContent for pre-filling the form
    // this runs only when the dialog is open (enabled: !!doc)
    const { data: fullDoc, isLoading: loadingContent } = useQuery({
        queryKey: ["document", doc?.id],
        queryFn: () => documentsApi.get(doc!.id),
        enabled: !!doc,
    });

    const form = useForm({
        resolver: zodResolver(z.object({
            title: z.string().trim().min(1, "Title is required"),
            content: z.string().trim().min(1, "Content cannot be empty"),
        })),
        // values syncs the form with fetched data when it arrives
        // unlike defaultValues which only sets the initial value once
        values: {
            title: fullDoc?.document.title ?? doc?.title ?? "",
            content: fullDoc?.document.content ?? "",
        },
    });

    const { mutate: updateDoc, isPending } = useMutation({
        mutationFn: (data: { title: string; content: string }) =>
            documentsApi.update(doc!.id, data),
        onSuccess: () => {
            // invalidate both the list and the individual document cache
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            queryClient.invalidateQueries({ queryKey: ["document", doc?.id] });
            onClose();
        },
        onError: (err) => {
            setServerError(err instanceof ApiError ? err.message : "Something went wrong");
        },
    });

    if (!doc) return null;

    return (
        <Dialog open={!!doc} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Note</DialogTitle>
                    <DialogDescription>Update your note's title or content.</DialogDescription>
                </DialogHeader>

                {serverError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {serverError}
                    </div>
                )}

                {/* show a loading state while we fetch the note content */}
                {loadingContent ? (
                    <div className="space-y-3 py-4">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : (
                    <form
                        onSubmit={form.handleSubmit((v) => updateDoc(v))}
                        className="space-y-4"
                    >
                        <FieldGroup>
                            <Controller
                                name="title"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="edit-title">Title</FieldLabel>
                                        <Input {...field} id="edit-title" disabled={isPending} aria-invalid={fieldState.invalid} />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="content"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="edit-content">Content</FieldLabel>
                                        <Textarea
                                            {...field}
                                            id="edit-content"
                                            rows={8}
                                            disabled={isPending}
                                            className="resize-none"
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                        <Button type="submit" className="w-full" disabled={isPending}>
                            {isPending
                                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                                : "Save changes"
                            }
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────
// DocumentCard
// ─────────────────────────────────────────────

function DocumentCard({
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

    // poll status every 3 seconds for documents still being processed
    // the select option runs after every successful fetch — when it detects
    // a terminal state it invalidates the list so the card gets fresh data
    // including the summary that only appears after COMPLETED
    useQuery({
        queryKey: ["document", doc.id, "status"],
        queryFn: () => documentsApi.getStatus(doc.id),
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "COMPLETED" || status === "FAILED" ? false : 3000;
        },
        enabled: doc.status === "PENDING" || doc.status === "PROCESSING",
        select: (data) => {
            // when we detect a terminal state, invalidate the documents list
            // so the card re-renders with the full updated document from the API
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
        // pass documentId as a query param — the chat page will create a scoped chat
        router.push(`/chat?documentId=${doc.id}`);
    };

    return (
        <div className="group relative rounded-lg border bg-card p-4 space-y-3 hover:border-primary/50 transition-colors">

            {/* three-dot menu — visible on hover */}
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
                        {/* chat about this — only meaningful once processing is done */}
                        {isCompleted && (
                            <DropdownMenuItem onClick={handleStartChat}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Chat about this
                            </DropdownMenuItem>
                        )}

                        {/* open source URL in a new tab for link/youtube */}
                        {(doc.type === "LINK" || doc.type === "YOUTUBE") && doc.sourceUrl && (
                            <DropdownMenuItem asChild>
                                <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open source
                                </a>
                            </DropdownMenuItem>
                        )}

                        {/* edit — only for notes since other types are read-only */}
                        {doc.type === "NOTE" && (
                            <DropdownMenuItem onClick={() => onEdit(doc)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit note
                            </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        {/* delete is always available, styled red to signal danger */}
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

            {/* clicking the card body navigates to the detail page */}
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

// ─────────────────────────────────────────────
// DocumentsPage
// ─────────────────────────────────────────────

export default function DocumentsPage() {
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [editDoc, setEditDoc] = useState<Document | null>(null);
    const [page, setPage] = useState(1);

    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["documents", page],
        queryFn: () => documentsApi.list(page, 12),
    });

    const documents = data?.documents ?? [];
    const pagination = data?.pagination;

    const { mutate: deleteDocument, isPending: isDeleting } = useMutation({
        mutationFn: (id: string) => documentsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            setDeleteId(null);
        },
    });

    return (
        <div className="space-y-6">
            {/* page header */}
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
                    <Plus className="h-4 w-4" />
                    Add Document
                </Button>
            </div>

            {/* empty state */}
            {!isLoading && documents.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
                    <div className="rounded-full bg-primary/10 p-4 mb-4">
                        <FileText className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No documents yet</h2>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                        Add links, YouTube videos, notes, or files to start building your knowledge base.
                    </p>
                    <Button onClick={() => setAddDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Add your first document
                    </Button>
                </div>
            )}

            {/* document grid */}
            {(isLoading || documents.length > 0) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {isLoading &&
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-lg border p-4 space-y-3">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        ))}

                    {!isLoading &&
                        documents.map((doc: Document) => (
                            <DocumentCard
                                key={doc.id}
                                doc={doc}
                                onDelete={(id) => setDeleteId(id)}
                                onEdit={(doc) => setEditDoc(doc)}
                            />
                        ))}
                </div>
            )}

            {/* pagination */}
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

            {/* dialogs */}
            <AddDocumentDialog
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
                onSuccess={() => setPage(1)}
            />

            <EditNoteDialog
                doc={editDoc}
                onClose={() => setEditDoc(null)}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes the document and all its embeddings from
                            your knowledge base. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteId && deleteDocument(deleteId)}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting
                                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</>
                                : "Delete"
                            }
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}