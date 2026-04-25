import { Button } from "@repo/ui/components/button";
import { Brain } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
            <Brain className="h-12 w-12 text-primary mb-6" />
            <h1 className="text-4xl font-bold mb-2">404</h1>
            <h2 className="text-xl font-semibold mb-3">Page not found</h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-sm">
                The page you're looking for doesn't exist or has been moved.
            </p>
            <div className="flex gap-3">
                <Button asChild>
                    <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/">Home</Link>
                </Button>
            </div>
        </div>
    );
}