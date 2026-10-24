import React, { useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/src/components/screen";
import { Button, Card, Field, Input } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { exportExcel, HEADERS, missingRequired, REQUIRED_IDX, rowFor, toTSV } from "@/src/utils/excel";
import { formatTgl } from "@/src/utils/format";

const COL_WIDTH = 150;
const MAX_ROWS = 100;

export default function EksporScreen() {
  const { state, setState } = useStore();
  const toast = useToast();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  function setSender<K extends keyof typeof state.sender>(k: K, v: string) {
    setState((s) => ({ ...s, sender: { ...s.sender, [k]: v } }));
  }

  const limited = state.pesanan.slice(0, MAX_ROWS);
  const allSelected = limited.length > 0 && limited.every((p) => selected[p.id]);

  function toggleAll() {
    if (allSelected) setSelected({});
    else {
      const next: Record<string, boolean> = {};
      limited.forEach((p) => (next[p.id] = true));
      setSelected(next);
    }
  }

  const chosen = useMemo(() => limited.filter((p) => selected[p.id]), [limited, selected]);
  const rows = useMemo(() => chosen.map((p, i) => rowFor(p, state.sender, i + 1)), [chosen, state.sender]);
  const totalMissing = useMemo(() => rows.reduce((a, r) => a + missingRequired(r), 0), [rows]);

  async function unduh() {
    if (rows.length === 0) {
      toast.show("Pilih minimal 1 pesanan");
      return;
    }
    if (totalMissing > 0) {
      toast.show(`Ada ${totalMissing} sel wajib kosong — lengkapi dulu`);
      return;
    }
    try {
      await exportExcel(rows);
      toast.show("File Excel dibuat");
    } catch (e: any) {
      toast.show("Gagal membuat file");
    }
  }

  async function salinTSV() {
    if (rows.length === 0) {
      toast.show("Pilih minimal 1 pesanan");
      return;
    }
    await Clipboard.setStringAsync(toTSV(rows));
    toast.show("Tersalin ke clipboard");
  }

  return (
    <Screen title="Ekspor" subtitle="Format Upload Order Everpro">
      <Card>
        <Text style={styles.cardTitle}>Data pengirim (isi sekali)</Text>
        <View style={{ height: spacing.sm }} />
        <Field label="Nama">
          <Input value={state.sender.nama} onChangeText={(v) => setSender("nama", v)} testID="sender-nama" />
        </Field>
        <Field label="Alamat">
          <Input value={state.sender.alamat} onChangeText={(v) => setSender("alamat", v)} multiline testID="sender-alamat" />
        </Field>
        <Field label="Telepon">
          <Input value={state.sender.telp} onChangeText={(v) => setSender("telp", v)} keyboardType="phone-pad" testID="sender-telp" />
        </Field>
        <Field label="Kecamatan">
          <Input value={state.sender.kec} onChangeText={(v) => setSender("kec", v)} testID="sender-kec" />
        </Field>
        <Field label="Kota">
          <Input value={state.sender.kota} onChangeText={(v) => setSender("kota", v)} testID="sender-kota" />
        </Field>
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.cardTitle}>Pilih pesanan</Text>
          <Pressable onPress={toggleAll}>
            <Text style={styles.link}>{allSelected ? "Kosongkan" : "Pilih semua"}</Text>
          </Pressable>
        </View>
        <View style={{ height: spacing.sm }} />
        {limited.length === 0 && <Text style={styles.muted}>Belum ada pesanan</Text>}
        {limited.map((p) => (
          <Pressable
            key={p.id}
            style={styles.rowSel}
            onPress={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))}
            testID={`sel-${p.id}`}
          >
            <Ionicons
              name={selected[p.id] ? "checkbox" : "square-outline"}
              size={20}
              color={colors.brandPrimary}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, color: colors.onSurface }}>{p.nama}</Text>
              <Text style={styles.muted}>
                {formatTgl(p.tgl)} · {p.kurir} · {p.tipe}
              </Text>
            </View>
          </Pressable>
        ))}
        {state.pesanan.length > MAX_ROWS && (
          <Text style={styles.muted}>Hanya {MAX_ROWS} pesanan pertama yang bisa dipilih.</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Pratinjau ({rows.length} baris)</Text>
        {totalMissing > 0 && (
          <Text style={styles.warn}>{totalMissing} sel wajib (ditandai pink) masih kosong</Text>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.previewHead}>
              {HEADERS.map((h, idx) => (
                <Text key={h} style={[styles.ph, { width: COL_WIDTH }]} numberOfLines={2}>
                  {h}
                </Text>
              ))}
            </View>
            {rows.map((r, i) => (
              <View key={i} style={styles.previewRow}>
                {r.map((cell, idx) => {
                  const req = REQUIRED_IDX.includes(idx);
                  const empty = cell === "" || cell === undefined || cell === null;
                  return (
                    <Text
                      key={idx}
                      style={[
                        styles.pc,
                        { width: COL_WIDTH },
                        req && empty && { backgroundColor: colors.accentMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {String(cell)}
                    </Text>
                  );
                })}
              </View>
            ))}
            {rows.length === 0 && <Text style={styles.muted}>Pilih pesanan untuk melihat pratinjau</Text>}
          </View>
        </ScrollView>
      </Card>

      <Button title="Unduh Excel (.xlsx)" icon="download-outline" onPress={unduh} testID="unduh-excel" />
      <Button title="Salin untuk Excel" kind="alt" icon="copy-outline" onPress={salinTSV} testID="salin-tsv" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontFamily: fonts.display, fontSize: fontSize.xl - 2, color: colors.onSurface },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base - 1 },
  link: { fontFamily: fonts.bold, color: colors.brandPrimary },
  warn: { fontFamily: fonts.semibold, color: colors.accent, marginVertical: 6 },
  rowSel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  previewHead: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingVertical: 7,
    marginBottom: 4,
  },
  ph: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.onSurfaceTertiary,
    paddingHorizontal: 6,
  },
  previewRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingVertical: 6,
  },
  pc: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onSurface, paddingHorizontal: 6 },
});
