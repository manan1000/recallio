"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/lib/api";
import { Input } from "@repo/ui/components/input";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Search, FileText, ExternalLink, SearchX } from "lucide-react";
import Link from "next/link";
import { useDebounce } from "@/hooks/use-debounce";
import type { SearchResult } from "@repo/types";

const typeLabel: Record<string, string> = {
    LINK: "Link",
    YOUTUBE: "YouTube",
    NOTE: "Note",
    PDF: "PDF",
    IMAGE: "Image",
    DOCUMENT: "Document",
};

export default function SearchPage() {
    const [query, setQuery] = useState("");

    // debounce the query so we don't hit the API on every keystroke
    // waits 400ms after the user stops typing before searching
    const debouncedQuery = useDebounce(query, 400);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["search", debouncedQuery],
        queryFn: () => searchApi.search(debouncedQuery),
        // only search when query has at least 3 characters
        // matches the backend's minimum query length validation
        enabled: debouncedQuery.trim().length >= 3,
    });

    const results = data?.results ?? [];
    const hasSearched = debouncedQuery.trim().length >= 3;
    const showSkeleton = hasSearched && (isLoading || isFetching);

    return (
        <div className="space-y-6 px-6 py-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Search</h1>
                <p className="text-muted-foreground mt-1">
                    Search your knowledge base semantically
                </p>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for anything..."
                    className="pl-9"
                    autoFocus
                />
            </div>

            {!hasSearched && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">
                        Type at least 3 characters to search your knowledge base
                    </p>
                </div>
            )}

            {showSkeleton && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="rounded-lg border p-4 space-y-2">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-2/3" />
                        </div>
                    ))}
                </div>
            )}

            {hasSearched && !showSkeleton && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <SearchX className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">No results found</p>
                    <p className="text-muted-foreground text-sm mt-1">
                        Try different keywords or add more documents to your knowledge base
                    </p>
                </div>
            )}

            {!showSkeleton && results.length > 0 && (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
                        <span className="font-medium text-foreground">
                            "{debouncedQuery}"
                        </span>
                    </p>
                    {results.map((result: SearchResult, i: number) => (
                        <Link
                            key={i}
                            href={`/documents/${result.documentId}`}
                            className="block rounded-lg border p-4 space-y-2 hover:border-primary/50 hover:bg-accent/50 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Badge variant="secondary" className="text-xs shrink-0">
                                        {typeLabel[result.documentType]}
                                    </Badge>
                                    <p className="font-medium text-sm truncate">
                                        {result.documentTitle ?? "Untitled"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-muted-foreground">
                                        {Math.round(result.similarity * 100)}% match
                                    </span>
                                    {result.sourceUrl && (
                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {result.content}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}