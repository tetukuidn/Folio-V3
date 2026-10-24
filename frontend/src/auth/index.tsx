import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { ApiError, api, clearToken, loadToken, saveToken } from "../api/client";

WebBrowser.maybeCompleteAuthSession();

const AUTH_BASE = "https://auth.emergentagent.com/";

export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  picture: string;
};

type AuthCtx = {
  loading: boolean;
  user: AuthUser | null;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function redirectUrl(): string {
  if (Platform.OS === "web") return window.location.origin + "/";
  return Linking.createURL("");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usedIds = useRef<Set<string>>(new Set());
  const hotUrl = useRef<string | null>(null);

  const exchange = useCallback(async (sessionId: string) => {
    if (usedIds.current.has(sessionId)) return;
    usedIds.current.add(sessionId);
    const res = await api<{ session_token: string; user: AuthUser }>("/api/auth/session", {
      method: "POST",
      body: { session_id: sessionId },
      auth: false,
    });
    await saveToken(res.session_token);
    setUser(res.user);
    setError(null);
  }, []);

  // Bootstrap: handle web callback first, then existing session.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (Platform.OS === "web") {
          const sid = extractSessionId(window.location.hash) || extractSessionId(window.location.search);
          if (sid) {
            try {
              await exchange(sid);
              const clean = window.location.pathname + window.location.search.replace(/[?&]session_id=[^&]*/g, "").replace(/^&/, "?");
              window.history.replaceState(window.history.state, "", clean || "/");
              if (alive) setLoading(false);
              return;
            } catch (e: any) {
              if (alive) setError(e?.message || "Gagal masuk");
            }
          }
        } else {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) {
            try {
              await exchange(sid);
              if (alive) setLoading(false);
              return;
            } catch (e: any) {
              if (alive) setError(e?.message || "Gagal masuk");
            }
          }
        }

        const token = await loadToken();
        if (!token) {
          if (alive) setLoading(false);
          return;
        }
        try {
          const res = await api<{ user: AuthUser }>("/api/auth/me");
          if (alive) setUser(res.user);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) await clearToken();
          if (alive) setUser(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [exchange]);

  // Hot deep links (native)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      hotUrl.current = url;
      const sid = extractSessionId(url);
      if (sid) exchange(sid).catch((e) => setError(e?.message || "Gagal masuk"));
    });
    return () => sub.remove();
  }, [exchange]);

  const signIn = useCallback(async () => {
    if (signingIn) return;
    setError(null);
    setSigningIn(true);
    try {
      const redirect = redirectUrl();
      const authUrl = `${AUTH_BASE}?redirect=${encodeURIComponent(redirect)}`;
      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }
      hotUrl.current = null;
      // Ephemeral session => fresh cookie jar per attempt, so a stale OAuth
      // "state" cookie from an earlier/aborted login can't break this one.
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect, {
        preferEphemeralSession: true,
        showInRecents: true,
      });
      const fromResult = (result as any)?.url as string | undefined;
      let sid = extractSessionId(fromResult) || extractSessionId(hotUrl.current);
      if (!sid) sid = extractSessionId(await Linking.getInitialURL());
      if (!sid) {
        const err = (fromResult || "").match(/error_description=([^&#]+)/);
        if (err) setError("Login gagal, coba lagi");
        setSigningIn(false);
        return;
      }
      await exchange(sid);
    } catch (e: any) {
      setError(e?.message || "Gagal masuk dengan Google");
    } finally {
      setSigningIn(false);
    }
  }, [exchange, signingIn]);

  const signOut = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {}
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ loading, user, signingIn, error, signIn, signOut }),
    [loading, user, signingIn, error, signIn, signOut]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
