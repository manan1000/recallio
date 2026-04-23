"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Brain, Home, FileText, Search, Plus, MessageSquare, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { chatsApi } from "@/lib/api";
import type { Chat } from "@repo/types";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarSeparator,
} from "@repo/ui/components/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Button } from "@repo/ui/components/button";

// navigation items for the main menu
// each has a label, url path, and lucide icon
const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    { label: "Documents", href: "/documents", icon: FileText },
    { label: "Search", href: "/search", icon: Search },
];

export function AppSidebar() {
    const pathname = usePathname(); // current URL path, used to highlight active nav item
    const router = useRouter();
    const { user, logout } = useAuth();

    // fetch recent chats using TanStack Query
    // queryKey is a unique identifier for this query in the cache
    // if any other component also uses ["chats"] as the key,
    // they share the same cached data — no duplicate requests
    const { data: chatsData, isLoading: chatsLoading } = useQuery({
        queryKey: ["chats"],
        queryFn: () => chatsApi.list(),
        // only fetch chats if user is logged in
        enabled: !!user,
    });

    const recentChats = chatsData?.chats?.slice(0, 8) ?? [];

    const handleNewChat = async () => {
        // navigate to chat page — the page itself will create the chat
        router.push("/chat");
    };

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    // generate avatar initials from user's name or email
    // e.g. "John Doe" → "JD", "john@example.com" → "J"
    const getInitials = (user: { name: string | null; email: string }) => {
        if (user.name) {
            return user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
        }
        return user.email[0]?.toUpperCase() ?? "U";
    };

    const getChatLabel = (chat: Chat): string => {
        // if chat has a title, use it
        if (chat.title) return chat.title;

        // if chat has messages, use the first message content trimmed to 30 chars
        const firstMessage = chat.messages?.[0]?.content;
        if (firstMessage) return firstMessage.slice(0, 30) + "...";

        // fallback
        return "Untitled Chat";
    };

    return (
        <Sidebar collapsible="icon">
            {/* ── Header ── */}
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Recallio">
                            <Link href="/dashboard">
                                <Brain className="h-5 w-5 text-primary" />
                                <span className="font-bold text-base group-data-[collapsible=icon]:hidden">
                                    Recallio
                                </span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {/* ── Main Navigation ── */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => {
                                // isActive checks if the current page matches this nav item
                                // we use exact match for dashboard, startsWith for others
                                // so /documents/123 still highlights "Documents"
                                const isActive =
                                    item.href === "/dashboard"
                                        ? pathname === "/dashboard"
                                        : pathname.startsWith(item.href);

                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                                            <Link href={item.href}>
                                                <item.icon className="h-4 w-4" />
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarSeparator />

                {/* ── New Chat Button ── */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    onClick={handleNewChat}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                    tooltip="New chat"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>New Chat</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* ── Recent Chats ── */}
                <SidebarGroup>
                    <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {/* show skeletons while loading */}
                            {chatsLoading && (
                                <>
                                    {[1, 2, 3].map((i) => (
                                        <SidebarMenuItem key={i}>
                                            <Skeleton className="h-8 w-full rounded-md" />
                                        </SidebarMenuItem>
                                    ))}
                                </>
                            )}

                            {/* show empty state if no chats */}
                            {!chatsLoading && recentChats.length === 0 && (
                                <p className="px-2 py-1 text-xs text-muted-foreground">
                                    No chats yet. Start a new chat above.
                                </p>
                            )}

                            {/* render each recent chat */}
                            {recentChats.map((chat: Chat) => {
                                const isActive = pathname === `/chat/${chat.id}`;

                                // use chat title if available, otherwise use the first message
                                // or fall back to "Untitled Chat"
                                const chatLabel = getChatLabel(chat);

                                return (
                                    <SidebarMenuItem key={chat.id}>
                                        <SidebarMenuButton asChild isActive={isActive}>
                                            <Link href={`/chat/${chat.id}`}>
                                                <MessageSquare className="h-4 w-4 shrink-0" />
                                                {/* truncate long titles */}
                                                <span className="truncate">{chatLabel}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* ── Footer — User Menu ── */}
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton size="lg">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-xs">
                                            {user ? getInitials(user) : "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col items-start text-sm">
                                        <span className="font-medium">
                                            {user?.name ?? "User"}
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                            {user?.email}
                                        </span>
                                    </div>
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                                side="top"
                                align="start"
                                className="w-56"
                            >
                                <DropdownMenuItem onClick={handleLogout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}