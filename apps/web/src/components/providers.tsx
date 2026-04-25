"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { Toaster } from "@repo/ui/components/sonner";

export const Providers = ({ children }: { children: React.ReactNode }) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 0,
                        refetchOnWindowFocus: false,
                        retry: (failureCount, error: any) => {
                            // check it's actually an ApiError with a status
                            const status = error?.status;
                            if (typeof status === "number" && [401, 403, 404].includes(status)) {
                                return false;
                            }
                            return failureCount < 2;
                        },
                    },
                    mutations: {
                        retry: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <TooltipProvider>
                    <AuthProvider>
                        {children}
                    </AuthProvider>
                </TooltipProvider>
            </ThemeProvider>
            <Toaster richColors position="bottom-right" />
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );

};