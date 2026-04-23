import type {
    ApiError as ApiErrorType,
    ErrorCode,
    User,
    Document,
    DocumentStatusResponse,
    Chat,
    Message,
    SearchResult,
    Pagination,
    Source,
} from "@repo/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
    constructor(
        public status: number,
        public code: ErrorCode,
        message: string,
        public fields?: { field: string; message: string }[]
    ) {
        super(message);
        this.name = "ApiError";
    }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    let body: any = null;

    try {
        body = await res.json();
    } catch {
        throw new ApiError(res.status, "INTERNAL_ERROR", "Invalid server response");
    }

    // all responses now have success boolean
    if (!body.success) {
        throw new ApiError(
            res.status,
            body.error.code,
            body.error.message,
            body.error.fields
        );
    }

    // unwrap data automatically — callers get data directly
    return body.data as T;
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

export const authApi = {
    register: (data: { email: string; password: string; name?: string }) =>
        request<{ user: User }>("/api/auth/register", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    login: (data: { email: string; password: string }) =>
        request<{ user: User }>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    logout: () =>
        request<{ message: string }>("/api/auth/logout", { method: "POST" }),

    me: () => request<{ user: User }>("/api/auth/me"),

    googleLogin: () => {
        window.location.href = `${BASE_URL}/api/auth/google`;
    },
};

// ─────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────

export const documentsApi = {
    list: (page = 1, limit = 20) =>
        request<{ documents: Document[]; pagination: Pagination }>(
            `/api/documents?page=${page}&limit=${limit}`
        ),

    get: (id: string) =>
        request<{ document: Document & { content?: string } }>(
            `/api/documents/${id}`
        ),

    getStatus: (id: string) =>
        request<DocumentStatusResponse>(`/api/documents/${id}/status`),

    create: (data: Record<string, unknown>) =>
        request<{ document: Pick<Document, "id" | "type" | "status" | "createdAt"> }>(
            "/api/documents",
            { method: "POST", body: JSON.stringify(data) }
        ),

    // PATCH only works for NOTE type — backend enforces this
    update: (id: string, data: { title?: string; content?: string }) =>
        request<{ document: Document }>(`/api/documents/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        request<{ message: string }>(`/api/documents/${id}`, {
            method: "DELETE",
        }),

    download: (id: string) =>
        request<{ downloadUrl: string; fileName: string }>(
            `/api/documents/${id}/download`
        ),
};

// ─────────────────────────────────────────────
// Uploads
// ─────────────────────────────────────────────

export const uploadsApi = {
    presign: (data: { fileName: string; mimeType: string; fileSize: number }) =>
        request<{ uploadUrl: string; fileUrl: string; filePath: string }>(
            "/api/uploads/presign",
            { method: "POST", body: JSON.stringify(data) }
        ),

    uploadToStorage: async (uploadUrl: string, file: File): Promise<void> => {
        const res = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
        });
        if (!res.ok) throw new ApiError(res.status, "INTERNAL_ERROR", "Failed to upload file");
    },
};

// ─────────────────────────────────────────────
// Chats
// ─────────────────────────────────────────────

export const chatsApi = {
    list: () =>
        request<{ chats: Chat[] }>("/api/chats"),

    get: (id: string) =>
        request<{ chat: Chat & { messages: Message[] } }>(`/api/chats/${id}`),

    create: (data: { title?: string; documentId?: string }) =>
        request<{ chat: Chat }>("/api/chats", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        request<{ message: string }>(`/api/chats/${id}`, { method: "DELETE" }),

    sendMessage: async (chatId: string, message: string): Promise<Response> => {
        const res = await fetch(`${BASE_URL}/api/chats/${chatId}/messages`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new ApiError(
                res.status,
                body.error?.code ?? "INTERNAL_ERROR",
                body.error?.message ?? "Something went wrong"
            );
        }
        return res;
    },
};

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────

export const searchApi = {
    search: (query: string) =>
        request<{ query: string; results: SearchResult[] }>(
            `/api/search?q=${encodeURIComponent(query)}`
        ),
};