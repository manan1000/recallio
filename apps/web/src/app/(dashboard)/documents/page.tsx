"use client";

// React hooks for managing local UI state
import { useState } from "react";

// TanStack Query for fetching and mutating data
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// form management
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// routing
import { useRouter } from "next/navigation";

// API client and error class
import { documentsApi, uploadsApi, ApiError } from "@/lib/api";

// shared types
import type { Document } from "@repo/types";

// the shared card component we just created
import { DocumentCard } from "@/components/document-card";

// UI components
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import {
    Field,
    FieldLabel,
    FieldError,
    FieldGroup,
} from "@repo/ui/components/field";
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@repo/ui/components/tabs";
import { Plus, FileText, Loader2, Upload } from "lucide-react";

// ─────────────────────────────────────────────
// Constants — accepted file types per document type
// ─────────────────────────────────────────────

const PDF_MIME_TYPES = ["application/pdf"];
const IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
];
const DOCUMENT_MIME_TYPES = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ─────────────────────────────────────────────
// Zod validation schemas
//
// Title is required in all schemas — this prevents documents from
// being created without names, which avoids "Untitled" clutter.
// The backend accepts optional titles (for programmatic use) but
// the frontend always enforces a title for better UX.
// ─────────────────────────────────────────────

const linkSchema = z.object({
    type: z.literal("LINK"),
    url: z.string().trim().url("Please enter a valid URL"),
    title: z.string().trim().min(1, "Please give this document a title"),
});

const youtubeSchema = z.object({
    type: z.literal("YOUTUBE"),
    url: z
        .string()
        .trim()
        .url("Please enter a valid URL")
        .refine((url) => {
            try {
                const { hostname } = new URL(url);
                return ["youtube.com", "www.youtube.com", "youtu.be"].includes(
                    hostname
                );
            } catch {
                return false;
            }
        }, "Please enter a valid YouTube URL"),
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
//
// This component is reused for PDF, IMAGE, and DOCUMENT tabs.
// The only things that differ between them are which MIME types
// they accept — everything else is identical.
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

    // maps the current upload phase to a button label
    // so users always know what's happening during the multi-step upload
    const getLabel = () => {
        if (!isPending) {
            return documentType === "PDF"
                ? "Add PDF"
                : documentType === "IMAGE"
                    ? "Add Image"
                    : "Add Document";
        }
        switch (uploadState) {
            case "presigning":
                return "Preparing upload...";
            case "uploading":
                return "Uploading file...";
            case "creating":
                return "Saving...";
            default:
                return "Processing...";
        }
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FieldGroup>
                {/* Title field — comes first so it's the first thing users fill in */}
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
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                {/* File picker field */}
                <Controller
                    name="file"
                    control={form.control}
                    render={({ field: { onChange }, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={`${documentType}-file`}>File</FieldLabel>
                            <input
                                id={`${documentType}-file`}
                                type="file"
                                accept={acceptString}
                                className="hidden"
                                disabled={isPending}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    // validate MIME type before touching the network
                                    if (!acceptedMimeTypes.includes(file.type)) {
                                        form.setError("file", {
                                            message: "File type not supported",
                                        });
                                        return;
                                    }

                                    // enforce the same 20MB limit as the Supabase bucket
                                    if (file.size > 20 * 1024 * 1024) {
                                        form.setError("file", {
                                            message: "File must be under 20MB",
                                        });
                                        return;
                                    }

                                    setSelectedFile(file);
                                    onChange(file); // register the file with react-hook-form
                                }}
                            />

                            {/* styled label acts as the visible file picker button */}
                            <label
                                htmlFor={`${documentType}-file`}
                                className={[
                                    "flex items-center gap-2 rounded-md border border-dashed p-4 transition-colors",
                                    isPending
                                        ? "opacity-50 cursor-not-allowed"
                                        : "cursor-pointer hover:border-primary/50 hover:bg-accent/50",
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

                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
            </FieldGroup>

            <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                    <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {getLabel()}
                    </>
                ) : (
                    getLabel()
                )}
            </Button>
        </form>
    );
}

// ─────────────────────────────────────────────
// AddDocumentDialog
//
// This dialog has six tabs — one per document type.
// Each tab has its own form with its own validation schema.
// Keeping forms separate means switching tabs doesn't
// carry over validation errors from the previous tab.
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

    // tracks which of the three upload phases we're in for file uploads
    // "idle" means no upload is in progress
    const [uploadState, setUploadState] = useState<"idle" | "presigning" | "uploading" | "creating"> ("idle");

    // isPending is true during file upload phases
    const isPending = uploadState !== "idle";
    const queryClient = useQueryClient();

    // separate form instances for each tab
    // this is intentional — it keeps validation state isolated per tab
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

    // useMutation for creating URL-based and note documents
    // onSuccess invalidates the cache so the list refreshes automatically
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
            setServerError(
                err instanceof ApiError ? err.message : "Something went wrong"
            );
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
        createDocument({
            type: values.type,
            content: values.content,
            title: values.title,
        });
    };

    // file uploads are three sequential async steps
    // if any step fails we show an error and reset the upload state
    // we block dialog close during upload to prevent orphaned Supabase files
    const handleFileSubmit = async (
        documentType: "PDF" | "IMAGE" | "DOCUMENT",
        values: FileForm
    ) => {
        setServerError(null);
        const file = values.file;

        try {
            // step 1: get a presigned URL from your Express API
            setUploadState("presigning");
            const { uploadUrl, fileUrl, filePath } = await uploadsApi.presign({
                fileName: file.name,
                mimeType: file.type,
                fileSize: file.size,
            });

            // step 2: upload the file directly to Supabase
            // your Express server never sees the file bytes — much more efficient
            setUploadState("uploading");
            await uploadsApi.uploadToStorage(uploadUrl, file);

            // step 3: create the document record in your database
            setUploadState("creating");
            createDocument({
                type: documentType,
                title: values.title,
                fileUrl,
                filePath,
                fileName: file.name,
                fileSize: file.size,
                // IMAGE type requires mimeType in the backend discriminated union
                ...(documentType === "IMAGE" && { mimeType: file.type }),
            });
        } catch (err) {
            setUploadState("idle");
            setServerError(
                err instanceof ApiError
                    ? err.message
                    : "Upload failed. Please try again."
            );
        }
    };

    return (
        // prevent closing during file upload to avoid leaving orphaned files in Supabase
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o && !isPending && !isCreating) onClose();
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add to Knowledge Base</DialogTitle>
                    <DialogDescription>
                        Add a link, YouTube video, note, image or file to your knowledge base.
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
                        <TabsTrigger value="LINK" className="flex-1">
                            Link
                        </TabsTrigger>
                        <TabsTrigger value="YOUTUBE" className="flex-1">
                            YouTube
                        </TabsTrigger>
                        <TabsTrigger value="NOTE" className="flex-1">
                            Note
                        </TabsTrigger>
                        <TabsTrigger value="PDF" className="flex-1">
                            PDF
                        </TabsTrigger>
                        <TabsTrigger value="IMAGE" className="flex-1">
                            Image
                        </TabsTrigger>
                        <TabsTrigger value="DOCUMENT" className="flex-1">
                            Doc
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="LINK">
                        <form
                            onSubmit={linkForm.handleSubmit(handleLinkSubmit)}
                            className="space-y-4 pt-2"
                        >
                            <FieldGroup>
                                <Controller
                                    name="title"
                                    control={linkForm.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="link-title">Title</FieldLabel>
                                            <Input
                                                {...field}
                                                id="link-title"
                                                placeholder="Give it a name..."
                                                disabled={isCreating}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
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
                                                disabled={isCreating}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <Button type="submit" className="w-full" disabled={isCreating}>
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    "Add Link"
                                )}
                            </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="YOUTUBE">
                        <form
                            onSubmit={youtubeForm.handleSubmit(handleYoutubeSubmit)}
                            className="space-y-4 pt-2"
                        >
                            <FieldGroup>
                                <Controller
                                    name="title"
                                    control={youtubeForm.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="yt-title">Title</FieldLabel>
                                            <Input
                                                {...field}
                                                id="yt-title"
                                                placeholder="Give it a name..."
                                                disabled={isCreating}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
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
                                                disabled={isCreating}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <Button type="submit" className="w-full" disabled={isCreating}>
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    "Add Video"
                                )}
                            </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="NOTE">
                        <form
                            onSubmit={noteForm.handleSubmit(handleNoteSubmit)}
                            className="space-y-4 pt-2"
                        >
                            <FieldGroup>
                                <Controller
                                    name="title"
                                    control={noteForm.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="note-title">Title</FieldLabel>
                                            <Input
                                                {...field}
                                                id="note-title"
                                                placeholder="Give it a name..."
                                                disabled={isCreating}
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
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
                                                disabled={isCreating}
                                                aria-invalid={fieldState.invalid}
                                                className="resize-none"
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                            <Button type="submit" className="w-full" disabled={isCreating}>
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    "Add Note"
                                )}
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
//
// Opens when the user clicks "Edit note" from the three-dot menu.
// Fetches the full document to pre-fill the content field — the
// documents list doesn't return content to keep payloads small.
// Submitting re-queues the document for processing since the
// embeddings need to be regenerated from the new content.
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

    // fetch the full document to get cleanContent for pre-filling
    // enabled: !!doc means this only runs when a doc is selected
    const { data: fullDoc, isLoading: loadingContent } = useQuery({
        queryKey: ["document", doc?.id],
        queryFn: () => documentsApi.get(doc!.id),
        enabled: !!doc,
    });

    const form = useForm({
        resolver: zodResolver(
            z.object({
                title: z.string().trim().min(1, "Title is required"),
                content: z.string().trim().min(1, "Content cannot be empty"),
            })
        ),
        // `values` (not `defaultValues`) syncs the form when fetched data arrives
        // defaultValues only sets the initial value once on mount
        // values re-syncs whenever fullDoc changes — this is what pre-fills the form
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
            setServerError(
                err instanceof ApiError ? err.message : "Something went wrong"
            );
        },
    });

    if (!doc) return null;

    return (
        <Dialog open={!!doc} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Note</DialogTitle>
                    <DialogDescription>
                        Saving will re-process the note and regenerate its summary and
                        embeddings.
                    </DialogDescription>
                </DialogHeader>

                {serverError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {serverError}
                    </div>
                )}

                {/* show skeletons while we fetch the note content */}
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
                                        <Input
                                            {...field}
                                            id="edit-title"
                                            disabled={isPending}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
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
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                        <Button type="submit" className="w-full" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save and re-process"
                            )}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────
// DocumentsPage — the main page component
//
// This is deliberately kept small. It manages three pieces of state:
// - page: which page of documents to show (for pagination)
// - deleteId: which document the user wants to delete (null = no dialog)
// - editDoc: which document the user wants to edit (null = no dialog)
//
// Everything else is delegated to child components.
// ─────────────────────────────────────────────

export default function DocumentsPage() {
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [editDoc, setEditDoc] = useState<Document | null>(null);
    const [page, setPage] = useState(1);

    const queryClient = useQueryClient();

    // fetch one page of documents
    // queryKey includes page so each page gets its own cache entry
    // navigating back to page 1 shows cached data instantly
    const { data, isLoading } = useQuery({
        queryKey: ["documents", page],
        queryFn: () => documentsApi.list(page, 12),
    });

    const documents = data?.documents ?? [];
    const pagination = data?.pagination;

    const { mutate: deleteDocument, isPending: isDeleting } = useMutation({
        mutationFn: (id: string) => documentsApi.delete(id),
        onSuccess: () => {
            // invalidate all document pages since deleting can shift items around
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            setDeleteId(null);
        },
    });

    return (
        <div className="space-y-6">

            {/* page header with document count and add button */}
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

            {/* empty state — only shown when loading is done and there are no documents */}
            {!isLoading && documents.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
                    <div className="rounded-full bg-primary/10 p-4 mb-4">
                        <FileText className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No documents yet</h2>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                        Add links, YouTube videos, notes, images or files to start building your
                        knowledge base.
                    </p>
                    <Button onClick={() => setAddDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Add your first document
                    </Button>
                </div>
            )}

            {/* document grid — shown while loading (skeletons) or when there are documents */}
            {(isLoading || documents.length > 0) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                    {/* skeleton placeholders while data loads */}
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
                                onEdit={(doc) => setEditDoc(doc)}
                            />
                        ))}
                </div>
            )}

            {/* pagination — only shown when there are multiple pages */}
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

            {/* dialogs — rendered at the bottom, outside the grid */}
            <AddDocumentDialog
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
                onSuccess={() => setPage(1)}
            />

            <EditNoteDialog
                doc={editDoc}
                onClose={() => setEditDoc(null)}
            />

            {/*
        AlertDialog for delete confirmation.
        open={!!deleteId} means: open when deleteId is not null.
        The !! converts a string to true and null to false.
      */}
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