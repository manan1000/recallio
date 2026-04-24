"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { chatsApi } from "@/lib/api";
import { Brain } from "lucide-react";

export default function NewChatPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const documentId = searchParams.get("documentId");
    const creating = useRef(false);

    useEffect(() => {
        if (creating.current) return;
        creating.current = true;

        const createAndRedirect = async () => {
            try {
                const { chat } = await chatsApi.create({
                    ...(documentId && { documentId }),
                });
                router.replace(`/chat/${chat.id}`);
            } catch {
                router.replace("/dashboard");
            }
        };

        createAndRedirect();
    }, []);

    return (
        <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <Brain className="h-8 w-8 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">Starting chat...</p>
            </div>
        </div>
    );
}