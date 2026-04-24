"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Brain } from "lucide-react";
import { Separator } from "@repo/ui/components/separator";

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
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) return <AuthLoadingScreen />;
  if (!user) return null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* top bar — contains the trigger and sits above the page content */}
        <header className="flex h-12 items-center gap-2 border-b px-4 sticky top-0 bg-background z-10">
          {/* SidebarTrigger is the hamburger button — it reads from SidebarProvider
              context and knows whether to show "open" or "close" icon automatically */}
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
        </header>

        <main className="flex flex-col flex-1 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}