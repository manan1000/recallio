import type {
    User,
    Document,
    DocumentStatusResponse,
    Chat,
    Message,
    SearchResult,
    Pagination,
} from "@repo/types";

// base URL from env — in dev this is http://localhost:4000
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────

// ApiError is a custom error class that carries the HTTP status code
// so we can check err.status === 401 instead of parsing error messages
export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
        this.name = "ApiError";
    }
}

// request() is the base function all API calls use
// T is a TypeScript generic — it means "whatever type the caller expects back"
// e.g. request<{ user: User }>(...) tells TypeScript the response has a user field
async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        // credentials: "include" sends the httpOnly cookie with every request
        // without this the browser won't send the auth cookie to your API
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    // if the response is not 2xx, throw an ApiError with the status code
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.error ?? "Something went wrong");
    }

    return res.json() as Promise<T>;
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

    // OAuth — just redirect the browser to the API
    // the API handles the redirect to Google and back
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

    delete: (id: string) =>
        request<{ message: string }>(`/api/documents/${id}`, { method: "DELETE" }),

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

    // uploadToStorage uploads directly to Supabase using the presigned URL
    // this never goes through your API — straight to Supabase
    uploadToStorage: async (uploadUrl: string, file: File): Promise<void> => {
        const res = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
        });
        if (!res.ok) throw new ApiError(res.status, "Failed to upload file");
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

    // sendMessage is different — it returns a streaming response
    // so we can't use request() which waits for the full response
    // instead we return the raw Response object and handle streaming in the component
    sendMessage: async (chatId: string, message: string): Promise<Response> => {
        const res = await fetch(`${BASE_URL}/api/chats/${chatId}/messages`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new ApiError(res.status, body.error ?? "Something went wrong");
        }
        return res; // return raw response for streaming
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