import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Card, Field, Input } from "./ui";
import { useToast } from "./toast";
import { useAuth } from "../auth";
import { useStore } from "../store";
import { colors, fonts, fontSize, radius, spacing } from "../theme";

export function ProfilCard() {
  const { user, signOut } = useAuth();
  const { profil, saveProfil, sync } = useStore();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(profil);

  useEffect(() => {
    if (!edit) setDraft(profil);
  }, [profil, edit]);

  const namaTampil = profil.namaPemilik || user?.name || "Pemilik toko";

  async function simpan() {
    setSaving(true);
    try {
      await saveProfil({
        namaPemilik: draft.namaPemilik.trim(),
        namaToko: draft.namaToko.trim(),
        waToko: draft.waToko.trim(),
      });
      toast.show("Profil tersimpan");
      setEdit(false);
    } catch {
      toast.show("Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card testID="profil-card">
      <View style={styles.head}>
        {user?.picture ? (
          <Image source={{ uri: user.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={24} color={colors.onBrandPrimary} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.nama} numberOfLines={1}>
            {namaTampil}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email || "-"}
          </Text>
          {profil.namaToko ? (
            <Text style={styles.email} numberOfLines={1}>
              {profil.namaToko}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={() => setEdit((v) => !v)} hitSlop={10} testID="profil-edit-toggle">
          <Ionicons name={edit ? "close-outline" : "create-outline"} size={22} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <View style={styles.syncRow}>
        <Ionicons
          name={sync === "error" ? "cloud-offline-outline" : sync === "saving" ? "cloud-upload-outline" : "cloud-done-outline"}
          size={14}
          color={sync === "error" ? colors.accent : colors.muted}
        />
        <Text style={[styles.syncText, sync === "error" && { color: colors.accent }]}>
          {sync === "saving" ? "Menyimpan ke server…" : sync === "error" ? "Gagal sinkron, cek koneksi" : "Data tersimpan online"}
        </Text>
      </View>

      {edit && (
        <View style={{ marginTop: spacing.md }}>
          <Field label="Nama pemilik">
            <Input
              value={draft.namaPemilik}
              onChangeText={(v) => setDraft((d) => ({ ...d, namaPemilik: v }))}
              testID="input-nama-pemilik"
            />
          </Field>
          <Field label="Nama toko">
            <Input
              value={draft.namaToko}
              onChangeText={(v) => setDraft((d) => ({ ...d, namaToko: v }))}
              testID="input-nama-toko"
            />
          </Field>
          <Field label="No. WA toko">
            <Input
              value={draft.waToko}
              onChangeText={(v) => setDraft((d) => ({ ...d, waToko: v }))}
              keyboardType="phone-pad"
              testID="input-wa-toko"
            />
          </Field>
          {saving ? (
            <View style={styles.syncRow}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={styles.syncText}>Menyimpan…</Text>
            </View>
          ) : (
            <Button title="Simpan profil" icon="save-outline" onPress={simpan} testID="simpan-profil" />
          )}
        </View>
      )}

      <View style={{ height: spacing.md }} />
      <Button title="Keluar akun" kind="out" icon="log-out-outline" onPress={signOut} testID="logout-btn" />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 54, height: 54, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  avatarFallback: { backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  nama: { fontFamily: fonts.display, fontSize: fontSize.xl - 2, color: colors.onSurface },
  email: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  syncText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted },
});
