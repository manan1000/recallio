"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { documentsApi, ApiError } from "@/lib/api";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Field, FieldLabel, FieldError, FieldGroup } from "@repo/ui/components/field";
import { Skeleton } from "@repo/ui/components/skeleton";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const editSchema = z.object({
    title: z.string().trim().min(1, "Title is required"),
    content: z.string().trim().min(1, "Content cannot be empty"),
});

type EditForm = z.infer<typeof editSchema>;

export default function EditNotePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();
    const [serverError, setServerError] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["document", id],
        queryFn: () => documentsApi.get(id),
    });

    const form = useForm<EditForm>({
        resolver: zodResolver(editSchema),
        values: {
            title: data?.document.title ?? "",
            content: data?.document.content ?? "",
        },
    });

    const { mutate: updateDoc, isPending } = useMutation({
        mutationFn: (values: EditForm) =>
            documentsApi.update(id, values),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            queryClient.invalidateQueries({ queryKey: ["document", id] });
            toast.success("Note saved", {
                description: "Re-processing has started in the background",
            });
            router.push(`/documents/${id}`);
        },
        onError: (err) => {
            const message = err instanceof ApiError ? err.message : "Something went wrong";
            setServerError(message);
            toast.error(message);
        },
    });

    if (isLoading) {
        return (
            <div className="px-4 py-6 sm:px-6 max-w-3xl mx-auto space-y-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (data?.document.type !== "NOTE") {
        router.push(`/documents/${id}`);
        return null;
    }

    return (
        <div className="px-4 py-6 sm:px-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="shrink-0" asChild>
                    <Link href={`/documents/${id}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="font-semibold text-lg">Edit Note</h1>
            </div>

            <p className="text-sm text-muted-foreground -mt-2">
                Saving will re-process the note and regenerate its embeddings and
                summary.
            </p>

            {serverError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {serverError}
                </div>
            )}

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
                                    rows={12}
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

                <div className="flex gap-2">
                    <Button type="submit" disabled={isPending}>
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save and re-process"
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        asChild
                    >
                        <Link href={`/documents/${id}`}>Cancel</Link>
                    </Button>
                </div>
            </form>
        </div>
    );
}