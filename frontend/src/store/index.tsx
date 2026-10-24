import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import { useAuth } from "../auth";
import { emptyProfil, emptyState, type Profil, type StoreState } from "./types";

type SyncStatus = "idle" | "saving" | "saved" | "error";

type Ctx = {
  state: StoreState;
  profil: Profil;
  loaded: boolean;
  sync: SyncStatus;
  setState: (updater: (s: StoreState) => StoreState) => void;
  saveProfil: (p: Profil) => Promise<void>;
  reset: () => void;
  refresh: () => Promise<void>;
};

const StoreCtx = createContext<Ctx | null>(null);

type DataResponse = { data: StoreState & { profil: Profil } };

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [state, _setState] = useState<StoreState>(() => emptyState());
  const [profil, setProfil] = useState<Profil>(() => emptyProfil());
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<SyncStatus>("idle");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    const res = await api<DataResponse>("/api/data");
    const d = res.data;
    _setState({
      belanja: d.belanja || [],
      suppliers: d.suppliers || [],
      pesanan: d.pesanan || [],
      sender: d.sender || emptyState().sender,
    });
    setProfil({
      namaPemilik: d.profil?.namaPemilik || "",
      namaToko: d.profil?.namaToko || "",
      waToko: d.profil?.waToko || "",
    });
  }, []);

  // Load user data when signed in
  useEffect(() => {
    let alive = true;
    if (!user) {
      _setState(emptyState());
      setProfil(emptyProfil());
      setLoaded(false);
      dirty.current = false;
      return;
    }
    setLoaded(false);
    (async () => {
      try {
        await fetchData();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await signOut();
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, fetchData, signOut]);

  // Debounced save to server
  useEffect(() => {
    if (!loaded || !user || !dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    setSync("saving");
    timer.current = setTimeout(async () => {
      try {
        await api("/api/data", { method: "PUT", body: state });
        setSync("saved");
        dirty.current = false;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await signOut();
        else setSync("error");
      }
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, loaded, user, signOut]);

  const setState = useCallback((updater: (s: StoreState) => StoreState) => {
    dirty.current = true;
    _setState((prev) => updater(prev));
  }, []);

  const reset = useCallback(() => {
    dirty.current = true;
    _setState(emptyState());
  }, []);

  const saveProfil = useCallback(
    async (p: Profil) => {
      const res = await api<{ profil: Profil }>("/api/profile", { method: "PUT", body: p });
      setProfil(res.profil);
    },
    []
  );

  const value = useMemo<Ctx>(
    () => ({ state, profil, loaded, sync, setState, saveProfil, reset, refresh: fetchData }),
    [state, profil, loaded, sync, setState, saveProfil, reset, fetchData]
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
