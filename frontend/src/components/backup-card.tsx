import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import { colors, fonts, fontSize, spacing } from "@/src/theme";
import { pilihBackup, simpanBackup, type BackupFile } from "@/src/utils/backup";
import { formatTgl } from "@/src/utils/format";

export function BackupCard() {
  const { state, profil, restore, saveProfil } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);

  const total =
    state.belanja.length + state.pesanan.length + state.pesananReseller.length + state.suppliers.length + state.resellers.length;

  async function simpan() {
    setBusy(true);
    try {
      await simpanBackup(state, profil);
      toast.show("File backup dibuat");
    } catch {
      toast.show("Gagal membuat file backup");
    } finally {
      setBusy(false);
    }
  }

  async function pilih() {
    try {
      const b = await pilihBackup();
      if (b) setPending(b);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Gagal membaca file");
    }
  }

  async function pulihkan() {
    if (!pending) return;
    setBusy(true);
    try {
      restore(pending.data);
      await saveProfil(pending.profil).catch(() => undefined);
      toast.show("Data berhasil dipulihkan");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const d = pending?.data;
  return (
    <Card testID="backup-card">
      <Text style={styles.title}>Backup semua data</Text>
      <Text style={styles.muted}>
        Simpan stok, pesanan, supplier, reseller, retur, barang rusak, data pengirim, dan profil ke satu file. File ini
        bisa dipulihkan kapan saja, misalnya saat pindah HP.
      </Text>
      <Text style={[styles.muted, { marginTop: 4 }]}>{total} catatan siap dibackup</Text>
      <View style={{ height: spacing.md }} />
      <Button title="Simpan file backup" icon="cloud-download-outline" onPress={simpan} disabled={busy} testID="backup-simpan" />
      <View style={{ height: spacing.sm }} />
      <Button title="Pulihkan dari file" kind="alt" icon="refresh-outline" onPress={pilih} disabled={busy} testID="backup-pilih" />

      {pending && d && (
        <View style={styles.confirm} testID="backup-konfirmasi">
          <Text style={styles.confirmTitle}>Ganti semua data dengan backup ini?</Text>
          <Text style={styles.muted}>Dibuat: {pending.dibuat ? formatTgl(pending.dibuat) : "-"}</Text>
          <Text style={styles.muted}>
            {d.belanja.length} stok · {d.pesanan.length} pesanan · {d.pesananReseller.length} pesanan reseller ·{" "}
            {d.suppliers.length} supplier · {d.resellers.length} reseller
          </Text>
          <Text style={styles.warn}>Data yang ada sekarang akan diganti dan tidak bisa dikembalikan.</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Batal" kind="out" onPress={() => setPending(null)} testID="backup-batal" />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Pulihkan" onPress={pulihkan} disabled={busy} testID="backup-pulihkan" />
            </View>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: fontSize.xl - 2, color: colors.onSurface, marginBottom: 4 },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base - 1 },
  confirm: { marginTop: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: colors.accentMuted, gap: 4 },
  confirmTitle: { fontFamily: fonts.bold, color: colors.onSurface, fontSize: fontSize.base },
  warn: { fontFamily: fonts.semibold, color: colors.accent, fontSize: fontSize.sm + 1, marginTop: 4 },
});
