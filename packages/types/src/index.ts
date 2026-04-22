// ─────────────────────────────────────────────
// Error codes
// ─────────────────────────────────────────────

export const ERROR_CODES = {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    RATE_LIMITED: "RATE_LIMITED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    NOT_IMPLEMENTED: "NOT_IMPLEMENTED"
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ─────────────────────────────────────────────
// API response shapes
// ─────────────────────────────────────────────

export type ApiSuccess<T> = {
    success: true;
    data: T;
};

export type ApiError = {
    success: false;
    error: {
        message: string;
        code: ErrorCode;
        fields?: { field: string; message: string }[];
    };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────

export type User = {
    id: string;
    email: string;
    name: string | null;
};

export type DocumentType =
    | "LINK"
    | "YOUTUBE"
    | "NOTE"
    | "PDF"
    | "IMAGE"
    | "DOCUMENT";

export type DocumentStatus =
    | "PENDING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED";

export type MessageRole = "USER" | "ASSISTANT";

export type Document = {
    id: string;
    type: DocumentType;
    title: string | null;
    sourceUrl: string | null;
    fileName: string | null;
    status: DocumentStatus;
    summary: string | null;
    error: string | null;
    createdAt: string;
};

export type DocumentStatusResponse = {
    id: string;
    status: DocumentStatus;
    error?: string | null;
};

export type Source = {
    chunkId: string;
    documentId: string;
    documentTitle: string | null;
    documentType: DocumentType;
    sourceUrl: string | null;
    similarity: number;
};

export type Message = {
    id: string;
    role: MessageRole;
    content: string;
    sources: Source[] | null;
    createdAt: string;
};

export type Chat = {
    id: string;
    title: string | null;
    documentId: string | null;
    createdAt: string;
    updatedAt: string;
    messages?: Message[];
};

export type SearchResult = {
    documentId: string;
    documentTitle: string | null;
    documentType: DocumentType;
    sourceUrl: string | null;
    content: string;
    similarity: number;
};

export type Pagination = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};