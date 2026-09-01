import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { User, AuthResponse } from "@acme/shared";
import { api, ApiError } from "./api";
import { queryClient } from "./queryClient";
import { AUTHENTICATED_QUERY_KEYS } from "./queryKeys";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (response: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("auth_token"),
  );
  const [isLoading, setIsLoading] = useState(!!token);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    api
      .get<User>("/auth/me")
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          localStorage.removeItem("auth_token");
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const clearAuthenticatedQueries = useCallback(() => {
    for (const queryKey of AUTHENTICATED_QUERY_KEYS) {
      queryClient.removeQueries({ queryKey });
    }
  }, []);

  const login = useCallback((response: AuthResponse) => {
    clearAuthenticatedQueries();
    localStorage.setItem("auth_token", response.token);
    setToken(response.token);
    setUser(response.user);
  }, [clearAuthenticatedQueries]);

  const logout = useCallback(() => {
    clearAuthenticatedQueries();
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  }, [clearAuthenticatedQueries]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
