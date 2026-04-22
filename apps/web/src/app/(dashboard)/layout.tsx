"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Brain } from "lucide-react";

function AuthLoadingScreen() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
                <Brain className="h-8 w-8 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // only redirect AFTER we're sure the user is not logged in
        // never redirect while loading is still true
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // still checking auth — show loading screen, NOT null
    // returning null causes unmount/remount which triggers the flash
    if (loading) return <AuthLoadingScreen />;

    // loading done, no user — redirect is happening via useEffect
    // return null here is fine because it's instant
    if (!user) return null;

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <main className="flex flex-col flex-1 p-6">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}