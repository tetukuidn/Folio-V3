import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { emptyState, type Profil, type StoreState } from "../store/types";
import { ymd } from "./format";

export type BackupFile = {
  app: "folio";
  version: 1;
  dibuat: string;
  data: StoreState;
  profil: Profil;
};

export function normalizeState(d: Partial<StoreState>): StoreState {
  return {
    belanja: d.belanja || [],
    rusak: d.rusak || [],
    suppliers: d.suppliers || [],
    pesanan: d.pesanan || [],
    sender: d.sender || emptyState().sender,
    resellers: d.resellers || [],
    pesananReseller: d.pesananReseller || [],
    returReseller: d.returReseller || [],
  };
}

const LAST_KEY = "folio_last_backup";

export async function lastBackupAt(): Promise<number | null> {
  const v = await AsyncStorage.getItem(LAST_KEY).catch(() => null);
  return v ? Number(v) : null;
}

async function markBackup() {
  await AsyncStorage.setItem(LAST_KEY, String(Date.now())).catch(() => undefined);
}

// Simpan semua data ke satu file backup Folio (.json)
export async function simpanBackup(state: StoreState, profil: Profil): Promise<void> {
  const file: BackupFile = { app: "folio", version: 1, dibuat: new Date().toISOString(), data: state, profil };
  const text = JSON.stringify(file);
  const name = `Backup_Folio_${ymd(new Date())}.json`;
  if (Platform.OS === "web") {
    const doc = (globalThis as any).document;
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement("a");
    a.href = url;
    a.download = name;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await markBackup();
    return;
  }
  const uri = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + name;
  await FileSystem.writeAsStringAsync(uri, text);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Simpan file backup", UTI: "public.json" });
  }
  await markBackup();
}

// Pilih file backup lalu baca isinya. null = dibatalkan.
export async function pilihBackup(): Promise<BackupFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const uri = res.assets[0].uri;
  const text = Platform.OS === "web" ? await (await fetch(uri)).text() : await FileSystem.readAsStringAsync(uri);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File bukan backup Folio");
  }
  if (!parsed || parsed.app !== "folio" || typeof parsed.data !== "object") throw new Error("File bukan backup Folio");
  return {
    app: "folio",
    version: 1,
    dibuat: parsed.dibuat || "",
    data: normalizeState(parsed.data),
    profil: {
      namaPemilik: parsed.profil?.namaPemilik || "",
      namaToko: parsed.profil?.namaToko || "",
      waToko: parsed.profil?.waToko || "",
    },
  };
}
