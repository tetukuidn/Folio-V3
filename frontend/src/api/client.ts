import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "lpm_session_token";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

let memToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (memToken) return memToken;
  try {
    if (Platform.OS === "web") {
      memToken = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    } else {
      memToken = await SecureStore.getItemAsync(TOKEN_KEY);
    }
  } catch {
    memToken = null;
  }
  return memToken;
}

export async function saveToken(token: string): Promise<void> {
  memToken = token;
  try {
    if (Platform.OS === "web") localStorage.setItem(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {}
}

export async function clearToken(): Promise<void> {
  memToken = null;
  try {
    if (Platform.OS === "web") localStorage.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {}
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await loadToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = String(j.detail);
    } catch {}
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
