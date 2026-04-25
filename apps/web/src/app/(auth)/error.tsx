"use client";

import { useEffect } from "react";
import { Button } from "@repo/ui/components/button";
import { AlertCircle } from "lucide-react";

export default function AuthError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="text-center space-y-4 max-w-sm">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                <h2 className="text-lg font-semibold">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">
                    An unexpected error occurred on this page.
                </p>
                <div className="flex gap-3 justify-center">
                    <Button onClick={reset}>Try again</Button>
                    <Button variant="outline" onClick={() => window.location.href = "/login"}>
                        Back to login
                    </Button>
                </div>
            </div>
        </div>
    );
}