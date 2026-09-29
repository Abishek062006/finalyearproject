/**
 * Who is signed in, and as what role. The navigator reads this to decide
 * which space to show (signed out -> Auth; parent -> Parent; educator ->
 * Educator), so signing in/out is just a state change — no manual screen
 * juggling.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, AuthUser } from "./api";
import { authStore } from "./authStore";

type Status = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: Status;
  user: AuthUser | null;
  /** Call after a successful login/register (the token is already in authStore). */
  refresh: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    if (!authStore.getToken()) {
      setUser(null);
      setStatus("signedOut");
      return;
    }
    try {
      setUser(await api.me());
      setStatus("signedIn");
    } catch {
      authStore.setToken(null); // stale or revoked token
      setUser(null);
      setStatus("signedOut");
    }
  }, []);

  useEffect(() => {
    authStore.hydrate().then(refresh);
  }, [refresh]);

  const signOut = useCallback(() => {
    authStore.setToken(null);
    setUser(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(() => ({ status, user, refresh, signOut }), [status, user, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
