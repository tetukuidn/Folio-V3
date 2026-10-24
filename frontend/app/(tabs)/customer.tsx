import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/src/components/screen";
import { Card, Chip, Input } from "@/src/components/ui";
import { useStore } from "@/src/store";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatRp, formatTgl } from "@/src/utils/format";
import { hitungRekap, totalItemJml } from "@/src/utils/calc";

export default function CustomerScreen() {
  const { state } = useStore();
  const [search, setSearch] = useState("");

  const totals = useMemo(() => {
    let pohon = 0;
    let hpp = 0;
    let untung = 0;
    for (const p of state.pesanan) {
      pohon += totalItemJml(p.items);
      const r = hitungRekap(p);
      hpp += r.totalHpp;
      untung += r.keuntungan;
    }
    return { pohon, hpp, untung };
  }, [state.pesanan]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.pesanan;
    return state.pesanan.filter((p) =>
      [p.nama, p.kota, p.kec, p.items.map((i) => i.jenis).join(" ")].join(" ").toLowerCase().includes(q)
    );
  }, [state.pesanan, search]);

  return (
    <Screen title="Customer" subtitle="Barang keluar per pesanan">
      <Input placeholder="Cari customer / jenis / kota" value={search} onChangeText={setSearch} testID="cust-search" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}
      >
        <Tile label="Pohon keluar" val={String(totals.pohon)} />
        <Tile label="Total HPP" val={formatRp(totals.hpp)} />
        <Tile label="Keuntungan" val={formatRp(totals.untung)} danger={totals.untung < 0} />
      </ScrollView>

      {filtered.length === 0 && (
        <Card>
          <Text style={styles.muted}>Belum ada pesanan</Text>
        </Card>
      )}

      {filtered.map((p) => {
        const r = hitungRekap(p);
        return (
          <Card key={p.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.cardTitle}>{p.nama}</Text>
              <Text style={styles.muted}>{formatTgl(p.tgl)}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {p.items.map((it) => (
                <Chip
                  key={it.jenis}
                  label={`${it.jenis} x${it.jml} · HPP ${formatRp(it.hpp)}`}
                  color="muted"
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", marginTop: spacing.md, gap: spacing.sm }}>
              <Mini label="Harga jual" val={formatRp(r.omset)} />
              <Mini label="Total HPP" val={formatRp(r.totalHpp)} />
              <Mini label="Keuntungan" val={formatRp(r.keuntungan)} danger={r.keuntungan < 0} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

function Tile({ label, val, danger }: { label: string; val: string; danger?: boolean }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.muted} numberOfLines={1}>{label}</Text>
      <Text
        style={[styles.tileVal, danger && { color: colors.accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {val}
      </Text>
    </View>
  );
}

function Mini({ label, val, danger }: { label: string; val: string; danger?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.muted} numberOfLines={1}>{label}</Text>
      <Text
        style={[styles.miniVal, danger && { color: colors.accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {val}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontFamily: fonts.display, fontSize: fontSize.xl - 2, color: colors.onSurface },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base - 1 },
  tile: {
    width: 148,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexShrink: 0,
  },
  tileVal: { fontFamily: fonts.display, fontSize: fontSize.xl - 2, color: colors.onSurface, marginTop: 4 },
  miniVal: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.onSurface, marginTop: 2 },
});
