"use client";

import { useEffect } from "react";
import { Button } from "@repo/ui/components/button";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
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
        <div className="flex flex-col items-center justify-center min-h-[400px] px-6 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                An unexpected error occurred. Try again or go back to the dashboard.
            </p>
            <div className="flex gap-3">
                <Button onClick={reset}>Try again</Button>
                <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
                    Go to Dashboard
                </Button>
            </div>
        </div>
    );
}