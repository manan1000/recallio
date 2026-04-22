"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@repo/types";
import { authApi, ApiError } from "@/lib/api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type AuthState = {
    user: User | null;
    loading: boolean;
    error: string | null;
};

type AuthContextType = AuthState & {
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => Promise<void>;
    googleLogin: () => void;
    setUser: (user: User | null) => void;
};

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null,
    });

    // check if user is already logged in when app loads
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { user } = await authApi.me();
                setState({ user, loading: false, error: null });
            } catch {
                // 401 = not logged in, that's fine
                setState({ user: null, loading: false, error: null });
            }
        };

        checkAuth();
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const { user } = await authApi.login({ email, password });
        setState({ user, loading: false, error: null });
    }, []);

    const register = useCallback(async (
        email: string,
        password: string,
        name?: string
    ) => {
        const { user } = await authApi.register({ email, password, name });
        setState({ user, loading: false, error: null });
    }, []);

    const logout = useCallback(async () => {
        await authApi.logout();
        setState({ user: null, loading: false, error: null });
    }, []);

    const googleLogin = useCallback(() => {
        authApi.googleLogin();
    }, []);

    const setUser = useCallback((user: User | null) => {
        setState((prev) => ({ ...prev, user }));
    }, []);

    return (
        <AuthContext.Provider value={{
            ...state,
            login,
            register,
            logout,
            googleLogin,
            setUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};