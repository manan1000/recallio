"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@repo/types";
import { authApi, ApiError } from "@/lib/api";

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
    clearError: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true,   // true on initial load
        error: null,
    });

    // check if user is already logged in when app loads
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { user } = await authApi.me();
                setState({ user, loading: false, error: null });
            } catch {
                setState({ user: null, loading: false, error: null });
            }
        };

        checkAuth();
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        try {
            setState((prev) => ({ ...prev, loading: true, error: null }));
            const { user } = await authApi.login({ email, password });
            setState({ user, loading: false, error: null });
        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : "Something went wrong";
            setState((prev) => ({ ...prev, loading: false, error: message }));
            throw err;
        }
    }, []);

    const register = useCallback(async (
        email: string,
        password: string,
        name?: string
    ) => {
        try {
            setState((prev) => ({ ...prev, loading: true, error: null }));
            const { user } = await authApi.register({ email, password, name });
            setState({ user, loading: false, error: null });
        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : "Something went wrong";
            setState((prev) => ({ ...prev, loading: false, error: message }));
            throw err;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            setState((prev) => ({ ...prev, loading: true, error: null }));
            await authApi.logout();
            setState({ user: null, loading: false, error: null });
        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : "Something went wrong";
            setState((prev) => ({ ...prev, loading: false, error: message }));
            throw err;
        }
    }, []);

    const googleLogin = useCallback(() => {
        authApi.googleLogin();
    }, []);

    const setUser = useCallback((user: User | null) => {
        setState((prev) => ({ ...prev, user }));
    }, []);

    // lets components clear the error after showing it
    // e.g. when user starts typing again in the form
    const clearError = useCallback(() => {
        setState((prev) => ({ ...prev, error: null }));
    }, []);

    return (
        <AuthContext.Provider value={{
            ...state,
            login,
            register,
            logout,
            googleLogin,
            setUser,
            clearError,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};