import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, fonts, fontSize, spacing } from "@/src/theme";
import { lastBackupAt } from "@/src/utils/backup";

const WEEK = 7 * 24 * 60 * 60 * 1000;

// Pengingat lembut di Dashboard bila belum backup selama 7 hari
export function BackupReminder({ hasData }: { hasData: boolean }) {
  const router = useRouter();
  const [last, setLast] = useState<number | null | undefined>(undefined);
  const [hidden, setHidden] = useState(false);

  useFocusEffect(
    useCallback(() => {
      lastBackupAt().then(setLast);
    }, [])
  );

  if (!hasData || hidden || last === undefined) return null;
  if (last !== null && Date.now() - last < WEEK) return null;
  const days = last === null ? null : Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));

  return (
    <View style={styles.box} testID="backup-reminder">
      <View style={styles.icon}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title}>Waktunya backup data</Text>
        <Text style={styles.sub}>
          {days === null ? "Belum ada backup di HP ini." : `Backup terakhir ${days} hari lalu.`} Simpan agar data aman.
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={() => router.push("/ekspor")} style={styles.btn} testID="backup-reminder-buka">
            <Text style={styles.btnText}>Backup sekarang</Text>
          </Pressable>
          <Pressable onPress={() => setHidden(true)} style={styles.btnGhost} testID="backup-reminder-nanti">
            <Text style={styles.ghostText}>Nanti</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  sub: { fontFamily: fonts.body, fontSize: fontSize.sm + 1, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  btn: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: 12, backgroundColor: colors.brandPrimary, justifyContent: "center" },
  btnText: { fontFamily: fonts.semibold, fontSize: fontSize.sm + 1, color: colors.onBrandPrimary },
  btnGhost: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: "center" },
  ghostText: { fontFamily: fonts.semibold, fontSize: fontSize.sm + 1, color: colors.muted },
});
