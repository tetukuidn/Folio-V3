import React, { useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/src/components/screen";
import { ProfilCard } from "@/src/components/profil-card";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import { useAuth } from "@/src/auth";
import { colors, fonts, fontSize, radius, shadow, spacing } from "@/src/theme";
import { formatRp, formatTgl } from "@/src/utils/format";
import { hitungRekap, jenisList, sisaStok, stokFIFO } from "@/src/utils/calc";

type Periode = "all" | "7" | "1m" | "3m" | "6m" | "range";

export default function DashboardScreen() {
  const { state, reset, profil, sync } = useStore();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [profilOpen, setProfilOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
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
    let ongkir = 0;
    let karantina = 0;
    let ops = 0;
    for (const p of filteredPesanan) {
      const r = hitungRekap(p);
      untung += r.keuntungan;
      omset += r.omset;
      transfer += r.totalTransfer;
      pohon += p.items.reduce((a, i) => a + i.jml, 0);
      hpp += r.totalHpp;
      ongkir += r.og;
      karantina += p.karantina || 0;
      ops += p.ops || 0;
    }
    const margin = omset > 0 ? (untung / omset) * 100 : 0;
    const modalPct = transfer > 0 ? (hpp / transfer) * 100 : 0;
    return { untung, omset, transfer, pohon, hpp, margin, ongkir, karantina, ops, modalPct };
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
      omset += r.totalTransfer;
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
    setConfirmReset(false);
    setProfilOpen(false);
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
    <Screen
      title="Dashboard"
      subtitle="Ringkasan performa toko"
      headerRight={
        <Pressable
          onPress={() => setProfilOpen(true)}
          style={({ pressed }) => [styles.profChip, pressed && { transform: [{ scale: 0.97 }] }]}
          testID="profil-chip"
        >
          <View style={{ alignItems: "flex-end", maxWidth: 84 }}>
            <Text style={styles.profName} numberOfLines={1}>
              {profil.namaToko || profil.namaPemilik || user?.name || "Toko"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: sync === "error" ? colors.error : sync === "saving" ? colors.warning : colors.action },
                ]}
              />
              <Text style={[styles.profStatus, sync === "error" && { color: colors.error }]} testID="profil-status">
                {sync === "error" ? "Offline" : sync === "saving" ? "Menyimpan" : "Online"}
              </Text>
            </View>
          </View>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.profAvatar} />
          ) : (
            <View style={[styles.profAvatar, styles.profAvatarFallback]}>
              <Ionicons name="person" size={18} color={colors.onBrandPrimary} />
            </View>
          )}
        </Pressable>
      }
    >
      <LinearGradient
        colors={[colors.brandPrimary, colors.brandDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
        testID="ringkasan-harian"
      >
        <View style={styles.heroHead}>
          <View style={styles.heroIcon}>
            <Ionicons name="sunny-outline" size={18} color={colors.onBrandPrimary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroTitle}>Ringkasan hari ini</Text>
            <Text style={styles.heroDate} numberOfLines={1}>{formatTgl(new Date().toISOString())}</Text>
          </View>
        </View>
        <View style={styles.heroRow}>
          <View style={styles.heroCell}>
            <Text style={styles.heroLbl}>Penjualan</Text>
            <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} testID="hari-ini-penjualan">
              {formatRp(hariIni.omset)}
            </Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroCell}>
            <Text style={styles.heroLbl}>Keuntungan</Text>
            <Text
              style={[styles.heroVal, hariIni.untung < 0 && { color: colors.accentMuted }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              testID="hari-ini-keuntungan"
            >
              {formatRp(hariIni.untung)}
            </Text>
          </View>
        </View>
        <View style={styles.heroLine} />
        <Text style={styles.heroFoot} numberOfLines={1} testID="hari-ini-foot">
          {hariIni.jml} pesanan · {hariIni.pohon} pohon keluar
        </Text>
      </LinearGradient>

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
      <Shortcut
        icon="storefront-outline"
        title="Reseller"
        sub={`${(state.resellers || []).length} reseller · ${(state.pesananReseller || []).length} pesanan`}
        onPress={() => router.push("/reseller")}
        testID="buka-reseller"
      />

      <View style={styles.card} testID="performa-finansial">
        <View style={styles.finHead}>
          <View style={styles.finIcon}>
            <Ionicons name="cash-outline" size={16} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.finTitle}>Performa Finansial</Text>
            <Text style={styles.finSub}>Akumulasi pembukuan</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
        >
          {options.map((o) => {
            const active = periode === o.k;
            return (
              <Pressable
                key={o.k}
                onPress={() => setPeriode(o.k)}
                style={[styles.chip, active && styles.chipActive]}
                testID={`periode-${o.k}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{o.l}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {periode === "range" && (
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
            <Pressable onPress={() => setShowDari(true)} style={styles.dateBtn} testID="tanggal-dari">
              <Text style={styles.dateLbl}>Dari</Text>
              <Text style={styles.dateVal} numberOfLines={1}>{formatTgl(dari.toISOString())}</Text>
            </Pressable>
            <Pressable onPress={() => setShowSampai(true)} style={styles.dateBtn} testID="tanggal-sampai">
              <Text style={styles.dateLbl}>Sampai</Text>
              <Text style={styles.dateVal} numberOfLines={1}>{formatTgl(sampai.toISOString())}</Text>
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

        <View style={styles.finRow}>
          <View style={styles.finBox} testID="fin-modal">
            <View style={styles.finBoxHead}>
              <Text style={styles.finLbl}>Modal</Text>
              <View style={styles.pctPill}>
                <Text style={styles.pctText}>{stats.modalPct.toFixed(1)}%</Text>
              </View>
            </View>
            <Text style={styles.finVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatRp(stats.hpp)}</Text>
            <Text style={styles.finNote} numberOfLines={1}>Biaya modal produk</Text>
          </View>
          <View style={[styles.finBox, { alignItems: "flex-end" }]} testID="fin-total-penjualan">
            <Text style={styles.finLbl}>Total Penjualan</Text>
            <Text style={styles.finVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatRp(stats.transfer)}</Text>
            <Text style={styles.finNote} numberOfLines={1}>Total omset kotor</Text>
          </View>
        </View>

        <View style={styles.finRow}>
          <MiniBox label="Ongkir" val={stats.ongkir} note="Pengiriman" testID="fin-ongkir" />
          <MiniBox label="Karantina" val={stats.karantina} note="Uji tanaman" testID="fin-karantina" />
          <MiniBox label="Operasional" val={stats.ops} note="Perlengkapan" testID="fin-operasional" />
        </View>

        <View style={[styles.labaBox, stats.untung < 0 && styles.labaBoxNeg]} testID="fin-laba">
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              <Text style={[styles.labaLbl, stats.untung < 0 && { color: colors.accent }]}>Laba Bersih (Profit)</Text>
              <View style={styles.marginPill}>
                <Text style={[styles.marginText, stats.untung < 0 && { color: colors.accent }]} testID="fin-margin">
                  {stats.margin >= 0 ? "+" : ""}
                  {stats.margin.toFixed(1)}% Margin
                </Text>
              </View>
            </View>
            <Text
              style={[styles.labaVal, stats.untung < 0 && { color: colors.accent }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              testID="fin-laba-value"
            >
              {formatRp(stats.untung)}
            </Text>
          </View>
          <View style={styles.labaIcon}>
            <Ionicons
              name={stats.untung < 0 ? "trending-down" : "trending-up"}
              size={20}
              color={stats.untung < 0 ? colors.accent : colors.brandPrimary}
            />
          </View>
        </View>
      </View>

      <Section title="Pesanan & barang keluar" testID="section-pesanan">
        <Row k="Jumlah pesanan" v={String(filteredPesanan.length)} />
        <Row k="Pohon keluar" v={String(stats.pohon)} />
        <Row k="Total HPP keluar" v={formatRp(stats.hpp)} />
        <Row k="Keuntungan" v={formatRp(stats.untung)} danger={stats.untung < 0} />
      </Section>

      <Section title="Stok barang (saat ini)" testID="section-stok">
        <Row k="Jenis tercatat" v={String(persediaanStats.jenisCount)} />
        <Row k="Stok awal" v={String(persediaanStats.stokAwal)} />
        <Row k="Stok masuk" v={String(persediaanStats.stokMasuk)} />
        <Row k="Stok sekarang" v={String(persediaanStats.stokNow)} />
        <Row k="Total HPP stok barang" v={formatRp(persediaanStats.totalHpp)} />
        <Row k="Nilai stok sekarang" v={formatRp(persediaanStats.nilaiStok)} />
      </Section>

      <Section title="Stok menipis (≤ 2)" testID="section-stok-menipis">
        {stokMenipis.length === 0 ? (
          <Text style={styles.muted}>Tidak ada</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {stokMenipis.map((s) => (
              <View key={s.j} style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>{s.j} · sisa {s.sisa}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="Jenis terlaris" testID="section-terlaris">
        {terlaris.length === 0 ? (
          <Text style={styles.muted}>Belum ada data</Text>
        ) : (
          <View style={{ gap: spacing.md }}>
            {terlaris.map((t) => (
              <View key={t.j}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Text style={styles.jenisName} numberOfLines={1}>{t.j}</Text>
                  <Text style={styles.rowVal}>{t.n}</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${(t.n / maxTerlaris) * 100}%` }]} />
                </View>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="Ekspedisi Pengiriman" testID="section-pengiriman">
        {perKurir.length === 0 ? (
          <Text style={styles.muted}>Belum ada pengiriman</Text>
        ) : (
          perKurir.map((p) => <Row key={p.k} k={p.k} v={`${p.count} paket · ${p.kg.toFixed(1)} kg`} />)
        )}
      </Section>

      <Modal visible={profilOpen} transparent animationType="slide" onRequestClose={() => setProfilOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={styles.scrim} onPress={() => setProfilOpen(false)} testID="profil-sheet-scrim" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="profil-sheet">
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Profil & akun</Text>
              <Pressable onPress={() => setProfilOpen(false)} hitSlop={10} style={styles.closeBtn} testID="profil-sheet-close">
                <Ionicons name="close" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <ProfilCard />
              {confirmReset ? (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmText}>
                    Hapus semua data akun ini (stok, pesanan, supplier, reseller, pesanan & retur reseller)? Tindakan ini tidak bisa dibatalkan.
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Pressable onPress={() => setConfirmReset(false)} style={styles.confirmCancel} testID="reset-batal">
                      <Text style={styles.confirmCancelText}>Batal</Text>
                    </Pressable>
                    <Pressable onPress={resetSemua} style={styles.confirmYes} testID="reset-ya">
                      <Text style={styles.confirmYesText}>Ya, hapus</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setConfirmReset(true)} style={styles.resetBtn} testID="reset-demo">
                  <Ionicons name="trash-outline" size={16} color={colors.accent} />
                  <Text style={styles.resetText}>Hapus semua data</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.card, styles.shortcut, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      <View style={styles.shortcutIcon}>
        <Ionicons name={icon} size={20} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.shortcutTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.muted} numberOfLines={1}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function MiniBox({ label, val, note, testID }: { label: string; val: number; note: string; testID?: string }) {
  return (
    <View style={[styles.finBox, styles.miniBox]} testID={testID}>
      <Text style={styles.finLbl} numberOfLines={1}>{label}</Text>
      <Text style={styles.miniVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatRp(val)}</Text>
      <Text style={styles.finNote} numberOfLines={1}>{note}</Text>
    </View>
  );
}

function Section({ title, children, testID }: { title: string; children: React.ReactNode; testID?: string }) {
  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <View style={styles.row}>
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

const tabular = { fontVariant: ["tabular-nums" as const] };
const W = "rgba(255,255,255,";

const styles = StyleSheet.create({
  profChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 4,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSecondary,
    ...shadow.card,
  },
  profName: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.onSurface },
  profStatus: { fontFamily: fonts.medium, fontSize: 10, color: colors.success },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  profAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary },
  profAvatarFallback: { backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },

  hero: { borderRadius: 24, padding: spacing.lg, overflow: "hidden" },
  heroHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: W + "0.14)",
    borderWidth: 1,
    borderColor: W + "0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onBrandPrimary },
  heroDate: { fontFamily: fonts.body, fontSize: fontSize.sm, color: W + "0.75)" },
  heroRow: { flexDirection: "row", marginTop: spacing.xl },
  heroCell: { flex: 1, minWidth: 0, gap: 4 },
  heroDivider: { width: 1, backgroundColor: W + "0.2)", marginHorizontal: spacing.md },
  heroLbl: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: W + "0.78)" },
  heroVal: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.onBrandPrimary, ...tabular },
  heroLine: { height: 1, backgroundColor: W + "0.16)", marginVertical: spacing.lg },
  heroFoot: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: W + "0.85)" },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: spacing.lg, ...shadow.card },
  shortcut: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 72 },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.sm + 1 },

  finHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  finIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  finTitle: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  finSub: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },

  chipRow: { flexGrow: 0, height: 56 },
  chipRowContent: { gap: 6, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted },
  chipTextActive: { color: colors.onBrandPrimary },

  dateBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dateLbl: { fontFamily: fonts.medium, color: colors.muted, fontSize: 11 },
  dateVal: { fontFamily: fonts.semibold, color: colors.onSurface, fontSize: fontSize.base },

  finRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  finBox: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    gap: 4,
  },
  miniBox: { padding: spacing.sm + 2, borderRadius: 14 },
  finBoxHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  finLbl: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  finVal: { fontFamily: fonts.bold, fontSize: fontSize.lg + 1, color: colors.onSurface, ...tabular },
  miniVal: { fontFamily: fonts.bold, fontSize: fontSize.sm + 1, color: colors.onSurface, ...tabular },
  finNote: { fontFamily: fonts.body, fontSize: 10, color: colors.muted },
  pctPill: { height: 20, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  pctText: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted, ...tabular },

  labaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    padding: spacing.lg,
    marginTop: 2,
  },
  labaBoxNeg: { backgroundColor: colors.accentMuted, borderColor: colors.accentMuted },
  labaLbl: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.brandPrimary },
  marginPill: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
  },
  marginText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.brandPrimary, ...tabular },
  labaVal: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.brandPrimary, marginTop: 6, ...tabular },
  labaIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  rowKey: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base, flexShrink: 1 },
  rowVal: { fontFamily: fonts.bold, color: colors.onSurface, fontSize: fontSize.base, textAlign: "right", ...tabular },

  tag: { height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.accentMuted, justifyContent: "center" },
  tagText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.onAccentMuted },
  jenisName: { flex: 1, fontFamily: fonts.medium, color: colors.onSurface, fontSize: fontSize.base },
  barBg: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, overflow: "hidden", marginTop: 6 },
  barFill: { height: 6, backgroundColor: colors.action, borderRadius: 3 },

  scrim: { flex: 1, backgroundColor: "rgba(11,31,22,0.45)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: "88%",
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sheetTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  resetBtn: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  resetText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.accent },
  confirmBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: colors.accentMuted, gap: spacing.md },
  confirmText: { fontFamily: fonts.medium, fontSize: fontSize.sm + 1, color: colors.onAccentMuted },
  confirmCancel: { flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  confirmCancelText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  confirmYes: { flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  confirmYesText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onAccent },
});
