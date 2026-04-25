"use client";

import { useEffect } from "react";
import { Button } from "@repo/ui/components/button";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
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
        <html>
            <body>
                <div className="min-h-screen flex items-center justify-center p-6 text-center">
                    <div className="space-y-4 max-w-sm">
                        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                        <h2 className="text-lg font-semibold">Something went wrong</h2>
                        <p className="text-sm text-muted-foreground">
                            A critical error occurred. Please refresh the page.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button onClick={reset}>Try again</Button>
                            <Button variant="outline" onClick={() => window.location.href = "/"}>
                                Go home
                            </Button>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}