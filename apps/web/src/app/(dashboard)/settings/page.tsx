"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { authApi, ApiError } from "@/lib/api";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Field, FieldLabel, FieldError, FieldGroup } from "@repo/ui/components/field";
import { Separator } from "@repo/ui/components/separator";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const profileSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
});

const passwordSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
    const { user, setUser } = useAuth();
    const [profileError, setProfileError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const profileForm = useForm<ProfileForm>({
        resolver: zodResolver(profileSchema),
        values: { name: user?.name ?? "" },
    });

    const passwordForm = useForm<PasswordForm>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    const { mutate: updateProfile, isPending: isUpdatingProfile } = useMutation({
        mutationFn: (data: ProfileForm) =>
            authApi.updateProfile({ name: data.name }),
        onSuccess: ({ user: updated }) => {
            setUser(updated);
            toast.success("Profile updated");
            setProfileError(null);
        },
        onError: (err) => {
            const message =
                err instanceof ApiError ? err.message : "Something went wrong";
            setProfileError(message);
            toast.error(message);
        },
    });

    const { mutate: updatePassword, isPending: isUpdatingPassword } = useMutation({
        mutationFn: (data: PasswordForm) =>
            authApi.updateProfile({
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            }),
        onSuccess: () => {
            toast.success("Password updated");
            passwordForm.reset();
            setPasswordError(null);
        },
        onError: (err) => {
            const message =
                err instanceof ApiError ? err.message : "Something went wrong";
            setPasswordError(message);
            toast.error(message);
        },
    });

    const getInitials = () => {
        if (user?.name) {
            return user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
        }
        return user?.email[0]?.toUpperCase() ?? "U";
    };

    return (
        <div className="px-4 py-8 sm:px-8 max-w-2xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Manage your account preferences
                </p>
            </div>

            <div className="space-y-10">
                <section className="space-y-6">
                    <div>
                        <h2 className="text-base font-semibold">Profile</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Update your display name and account information
                        </p>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-lg border">
                        <Avatar className="h-14 w-14 shrink-0">
                            <AvatarFallback className="text-base font-medium">
                                {getInitials()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium">{user?.name ?? "No name set"}</p>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                    </div>

                    {profileError && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            {profileError}
                        </div>
                    )}

                    <form
                        onSubmit={profileForm.handleSubmit((v) => updateProfile(v))}
                        className="space-y-4"
                    >
                        <FieldGroup>
                            <Controller
                                name="name"
                                control={profileForm.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="name">Display name</FieldLabel>
                                        <Input
                                            {...field}
                                            id="name"
                                            disabled={isUpdatingProfile}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                        <Button type="submit" disabled={isUpdatingProfile}>
                            {isUpdatingProfile ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save changes"
                            )}
                        </Button>
                    </form>
                </section>

                <Separator />

                <section className="space-y-6">
                    <div>
                        <h2 className="text-base font-semibold">Password</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Change your password. You will need your current password to
                            make this change.
                        </p>
                    </div>

                    {passwordError && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            {passwordError}
                        </div>
                    )}

                    <form
                        onSubmit={passwordForm.handleSubmit((v) => updatePassword(v))}
                        className="space-y-4"
                    >
                        <FieldGroup>
                            <Controller
                                name="currentPassword"
                                control={passwordForm.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="currentPassword">
                                            Current password
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id="currentPassword"
                                            type="password"
                                            disabled={isUpdatingPassword}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="newPassword"
                                control={passwordForm.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                                        <Input
                                            {...field}
                                            id="newPassword"
                                            type="password"
                                            disabled={isUpdatingPassword}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="confirmPassword"
                                control={passwordForm.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="confirmPassword">
                                            Confirm new password
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            id="confirmPassword"
                                            type="password"
                                            disabled={isUpdatingPassword}
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                        <Button type="submit" disabled={isUpdatingPassword}>
                            {isUpdatingPassword ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                "Update password"
                            )}
                        </Button>
                    </form>
                </section>

                <Separator />

                <section className="space-y-4">
                    <div>
                        <h2 className="text-base font-semibold">Account</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage your account details
                        </p>
                    </div>
                    <div className="rounded-lg border p-4 space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Email address
                        </p>
                        <p className="text-sm">{user?.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Your email cannot be changed.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}