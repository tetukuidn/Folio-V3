import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "@/src/components/screen";
import { Button, Card, Chip } from "@/src/components/ui";
import { ProfilCard } from "@/src/components/profil-card";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatRp, formatTgl } from "@/src/utils/format";
import { hitungRekap, hppJenis, jenisList, sisaStok, stokFIFO, stokMasuk } from "@/src/utils/calc";

type Periode = "all" | "7" | "1m" | "3m" | "6m" | "range";

export default function DashboardScreen() {
  const { state, reset } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [periode, setPeriode] = useState<Periode>("all");
  const [dari, setDari] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  });
  const [sampai, setSampai] = useState<Date>(() => new Date());
  const [showDari, setShowDari] = useState(false);
  const [showSampai, setShowSampai] = useState(false);

  const range = useMemo(() => {
    const now = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let start: Date | null = null;
    if (periode === "7") {
      start = new Date();
      start.setDate(now.getDate() - 7);
    } else if (periode === "1m") {
      start = new Date();
      start.setMonth(now.getMonth() - 1);
    } else if (periode === "3m") {
      start = new Date();
      start.setMonth(now.getMonth() - 3);
    } else if (periode === "6m") {
      start = new Date();
      start.setMonth(now.getMonth() - 6);
    } else if (periode === "range") {
      start = new Date(dari);
      start.setHours(0, 0, 0, 0);
      end.setTime(new Date(sampai).setHours(23, 59, 59, 999));
    }
    return { start, end };
  }, [periode, dari, sampai]);

  const filteredPesanan = useMemo(() => {
    return state.pesanan.filter((p) => {
      if (!range.start) return true;
      const t = new Date(p.tgl).getTime();
      return t >= range.start.getTime() && t <= range.end.getTime();
    });
  }, [state.pesanan, range]);

  const stats = useMemo(() => {
    let untung = 0;
    let omset = 0;
    let transfer = 0;
    let pohon = 0;
    let hpp = 0;
    for (const p of filteredPesanan) {
      const r = hitungRekap(p);
      untung += r.keuntungan;
      omset += r.omset;
      transfer += r.totalTransfer;
      pohon += p.items.reduce((a, i) => a + i.jml, 0);
      hpp += r.totalHpp;
    }
    const margin = omset > 0 ? (untung / omset) * 100 : 0;
    return { untung, omset, transfer, pohon, hpp, margin };
  }, [filteredPesanan]);

  const hariIni = useMemo(() => {
    const now = new Date();
    const sameDay = (iso: string) => {
      const d = new Date(iso);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    };
    let omset = 0;
    let untung = 0;
    let pohon = 0;
    let jml = 0;
    for (const p of state.pesanan) {
      if (!sameDay(p.tgl)) continue;
      const r = hitungRekap(p);
      omset += r.omset;
      untung += r.keuntungan;
      pohon += p.items.reduce((a, i) => a + i.jml, 0);
      jml++;
    }
    return { omset, untung, pohon, jml };
  }, [state.pesanan]);

  const persediaanStats = useMemo(() => {
    const list = jenisList(state);
    const fifo = stokFIFO(state);
    const stokAwal = state.belanja.reduce((a, b) => a + b.awal, 0);
    const stokMasukTot = state.belanja.reduce((a, b) => a + b.jml, 0);
    const stokNow = state.belanja.reduce((a, b) => a + (fifo[b.id] ?? 0), 0);
    const totalHpp = state.belanja.reduce((a, b) => a + b.jml * b.harga, 0);
    const nilaiStok = state.belanja.reduce((a, b) => a + (fifo[b.id] ?? 0) * b.harga, 0);
    return { jenisCount: list.length, stokAwal, stokMasuk: stokMasukTot, stokNow, totalHpp, nilaiStok };
  }, [state]);

  const stokMenipis = useMemo(() => {
    return jenisList(state)
      .map((j) => ({ j, sisa: sisaStok(state, j) }))
      .filter((x) => x.sisa <= 2);
  }, [state]);

  const terlaris = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of filteredPesanan) {
      for (const it of p.items) {
        map[it.jenis] = (map[it.jenis] ?? 0) + it.jml;
      }
    }
    const arr = Object.entries(map).map(([j, n]) => ({ j, n }));
    arr.sort((a, b) => b.n - a.n);
    return arr.slice(0, 8);
  }, [filteredPesanan]);

  const perKurir = useMemo(() => {
    const map: Record<string, { count: number; kg: number }> = {};
    for (const p of filteredPesanan) {
      const k = p.kurir || "-";
      const m = (map[k] ||= { count: 0, kg: 0 });
      m.count++;
      m.kg += p.berat || 0;
    }
    return Object.entries(map).map(([k, v]) => ({ k, ...v }));
  }, [filteredPesanan]);

  const maxTerlaris = Math.max(1, ...terlaris.map((t) => t.n));

  function resetSemua() {
    reset();
    toast.show("Semua data akun ini dihapus");
  }

  const options: { k: Periode; l: string }[] = [
    { k: "all", l: "Semua" },
    { k: "7", l: "7 hari" },
    { k: "1m", l: "1 bulan" },
    { k: "3m", l: "3 bulan" },
    { k: "6m", l: "6 bulan" },
    { k: "range", l: "Pilih tanggal" },
  ];

  return (
    <Screen title="Dashboard" subtitle="Ringkasan performa toko">
      <Card style={styles.today} testID="ringkasan-harian">
        <View style={styles.todayHead}>
          <View style={styles.todayBadge}>
            <Ionicons name="sunny-outline" size={16} color={colors.onBrandPrimary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.todayTitle}>Ringkasan hari ini</Text>
            <Text style={styles.todayDate} numberOfLines={1}>
              {formatTgl(new Date().toISOString())}
            </Text>
          </View>
        </View>

        <View style={styles.todayRow}>
          <View style={styles.todayCell}>
            <Text style={styles.todayLbl}>Penjualan</Text>
            <Text style={styles.todayVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {formatRp(hariIni.omset)}
            </Text>
          </View>
          <View style={styles.todayDivider} />
          <View style={styles.todayCell}>
            <Text style={styles.todayLbl}>Keuntungan</Text>
            <Text
              style={[styles.todayVal, hariIni.untung < 0 && { color: colors.accentMuted }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatRp(hariIni.untung)}
            </Text>
          </View>
        </View>

        <Text style={styles.todayFoot} numberOfLines={1}>
          {hariIni.jml} pesanan · {hariIni.pohon} pohon keluar
        </Text>
      </Card>

      <ProfilCard />

      <Shortcut
        icon="leaf-outline"
        title="Stok barang"
        sub={`${persediaanStats.jenisCount} jenis · ${persediaanStats.stokNow} pohon tersisa`}
        onPress={() => router.push("/stok-barang")}
        testID="buka-stok-barang"
      />

      <Shortcut
        icon="people-outline"
        title="Supplier"
        sub={`${state.suppliers.length} supplier tersimpan`}
        onPress={() => router.push("/supplier")}
        testID="buka-supplier"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
      >
        {options.map((o) => (
          <Chip
            key={o.k}
            label={o.l}
            active={periode === o.k}
            onPress={() => setPeriode(o.k)}
            color={periode === o.k ? "pink" : "muted"}
            testID={`periode-${o.k}`}
          />
        ))}
      </ScrollView>

      {periode === "range" && (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable onPress={() => setShowDari(true)} style={styles.dateBtn}>
            <Text style={styles.dateLbl}>Dari</Text>
            <Text style={styles.dateVal}>{formatTgl(dari.toISOString())}</Text>
          </Pressable>
          <Pressable onPress={() => setShowSampai(true)} style={styles.dateBtn}>
            <Text style={styles.dateLbl}>Sampai</Text>
            <Text style={styles.dateVal}>{formatTgl(sampai.toISOString())}</Text>
          </Pressable>
          {showDari && (
            <DateTimePicker
              value={dari}
              mode="date"
              onChange={(_, d) => {
                setShowDari(Platform.OS === "ios");
                if (d) setDari(d);
              }}
            />
          )}
          {showSampai && (
            <DateTimePicker
              value={sampai}
              mode="date"
              onChange={(_, d) => {
                setShowSampai(Platform.OS === "ios");
                if (d) setSampai(d);
              }}
            />
          )}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}
      >
        <Tile label="Keuntungan" val={formatRp(stats.untung)} danger={stats.untung < 0} />
        <Tile label="Harga jual" val={formatRp(stats.omset)} />
        <Tile label="Total transfer" val={formatRp(stats.transfer)} />
        <Tile label="Margin" val={`${stats.margin.toFixed(1)}%`} />
      </ScrollView>

      <Card>
        <Text style={styles.cardTitle}>Pesanan & barang keluar</Text>
        <Row k="Jumlah pesanan" v={String(filteredPesanan.length)} />
        <Row k="Pohon keluar" v={String(stats.pohon)} />
        <Row k="Total HPP keluar" v={formatRp(stats.hpp)} />
        <Row k="Keuntungan" v={formatRp(stats.untung)} danger={stats.untung < 0} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Stok barang (saat ini)</Text>
        <Row k="Jenis tercatat" v={String(persediaanStats.jenisCount)} />
        <Row k="Stok awal" v={String(persediaanStats.stokAwal)} />
        <Row k="Stok masuk" v={String(persediaanStats.stokMasuk)} />
        <Row k="Stok sekarang" v={String(persediaanStats.stokNow)} />
        <Row k="Total HPP stok barang" v={formatRp(persediaanStats.totalHpp)} />
        <Row k="Nilai stok sekarang" v={formatRp(persediaanStats.nilaiStok)} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Stok menipis (≤ 2)</Text>
        {stokMenipis.length === 0 ? (
          <Text style={styles.muted}>Tidak ada</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {stokMenipis.map((s) => (
              <Chip key={s.j} label={`${s.j} · sisa ${s.sisa}`} color="pink" />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Jenis terlaris</Text>
        {terlaris.length === 0 ? (
          <Text style={styles.muted}>Belum ada data</Text>
        ) : (
          <View style={{ marginTop: 6, gap: 6 }}>
            {terlaris.map((t) => (
              <View key={t.j}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.jenisName}>{t.j}</Text>
                  <Text style={styles.muted}>{t.n}</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${(t.n / maxTerlaris) * 100}%` }]} />
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Rekap pengiriman</Text>
        {perKurir.length === 0 ? (
          <Text style={styles.muted}>Belum ada pengiriman</Text>
        ) : (
          perKurir.map((p) => (
            <Row key={p.k} k={p.k} v={`${p.count} paket · ${p.kg.toFixed(1)} kg`} />
          ))
        )}
      </Card>

      <Button title="Hapus semua data" kind="out" icon="trash-outline" onPress={resetSemua} testID="reset-demo" />
    </Screen>
  );
}

function Shortcut({
  icon,
  title,
  sub,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable onPress={onPress} testID={testID}>
      <Card style={styles.shortcut}>
        <View style={styles.shortcutIcon}>
          <Ionicons name={icon} size={22} color={colors.brandPrimary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.shortcutTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Card>
    </Pressable>
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

function Row({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, gap: 8 }}>
      <Text style={styles.rowKey} numberOfLines={1}>{k}</Text>
      <Text
        style={[styles.rowVal, danger && { color: colors.accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  today: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary, gap: spacing.md },
  todayHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  todayBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  todayTitle: { fontFamily: fonts.display, fontSize: fontSize.lg + 1, color: colors.onBrandPrimary },
  todayDate: { fontFamily: fonts.body, fontSize: fontSize.sm, color: "rgba(255,255,255,0.75)" },
  todayRow: { flexDirection: "row", alignItems: "stretch" },
  todayCell: { flex: 1, minWidth: 0, gap: 2 },
  todayDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.22)", marginHorizontal: spacing.md },
  todayLbl: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: "rgba(255,255,255,0.78)" },
  todayVal: { fontFamily: fonts.display, fontSize: fontSize.xxl - 2, color: colors.onBrandPrimary },
  todayFoot: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: "rgba(255,255,255,0.78)" },
  cardTitle: { fontFamily: fonts.display, fontSize: fontSize.xl - 2, color: colors.onSurface, marginBottom: 6 },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base - 1 },
  shortcut: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutTitle: { fontFamily: fonts.display, fontSize: fontSize.lg + 2, color: colors.onSurface },
  tile: {
    width: 152,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexShrink: 0,
  },
  tileVal: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface, marginTop: 4 },
  dateBtn: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md + 2,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateLbl: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.sm },
  dateVal: { fontFamily: fonts.bold, color: colors.onSurface, marginTop: 2, fontSize: fontSize.base },
  barBg: {
    height: 10,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: 4,
  },
  barFill: { height: 10, backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  rowKey: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base - 1, flexShrink: 1 },
  rowVal: { fontFamily: fonts.bold, color: colors.onSurface, fontSize: fontSize.base },
  jenisName: { fontFamily: fonts.medium, color: colors.onSurface, fontSize: fontSize.base },
});
