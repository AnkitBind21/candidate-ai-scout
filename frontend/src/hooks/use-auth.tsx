import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "@/lib/api-client";
import type { MessageResponse, TokenResponse, User } from "@/lib/api-types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  signup: (full_name: string, email: string, password: string) => Promise<string>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const current = tokenStore.get();
    if (!current) {
      setUser(null);
      setToken(null);
      return;
    }
    setToken(current);
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    void refreshUser().finally(() => setReady(true));
    return () => setUnauthorizedHandler(null);
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const res = await api.post<TokenResponse>("/auth/login", { email, password }, false);
    tokenStore.set(res.access_token, remember);
    setToken(res.access_token);
    setUser(res.user);
  }, []);

  const signup = useCallback(async (full_name: string, email: string, password: string) => {
    const res = await api.post<MessageResponse>(
      "/auth/register",
      { full_name, email, password },
      false,
    );
    return res?.message ?? "Account created successfully.";
  }, []);

  const value = useMemo(
    () => ({ user, token, ready, login, signup, logout, refreshUser }),
    [user, token, ready, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}