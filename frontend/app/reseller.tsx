import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Screen } from "@/src/components/screen";
import { Button, Card, Field, Input } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import type { Reseller } from "@/src/store/types";
import { colors, fonts, fontSize, radius, shadow, spacing } from "@/src/theme";
import { formatRp, formatTgl, uid } from "@/src/utils/format";
import { pct } from "@/src/utils/calc";
import { nilaiJual, statsOf } from "@/src/utils/reseller";
import { normalizeWA } from "@/src/utils/phone";

type Periode = "all" | "7" | "1m" | "3m" | "6m";

const PERIODE: { k: Periode; l: string }[] = [
  { k: "all", l: "Semua" },
  { k: "7", l: "7 hari" },
  { k: "1m", l: "1 bulan" },
  { k: "3m", l: "3 bulan" },
  { k: "6m", l: "6 bulan" },
];

function startOf(p: Periode): number | null {
  if (p === "all") return null;
  const d = new Date();
  if (p === "7") d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - (p === "1m" ? 1 : p === "3m" ? 3 : 6));
  return d.getTime();
}

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export default function ResellerScreen() {
  const { state, setState, loaded } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [periode, setPeriode] = useState<Periode>("all");
  const [filterRes, setFilterRes] = useState("");
  const [kelola, setKelola] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [hp, setHp] = useState("");
  const [cat, setCat] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const resellers = state.resellers || [];
  const orders = state.pesananReseller || [];
  const returs = state.returReseller || [];
  const rusakRes = (state.rusak || []).filter((r) => r.resellerId);

  const start = startOf(periode);
  const inRange = (tgl: string) => start === null || new Date(tgl).getTime() >= start;
  const byRes = (id: string) => !filterRes || id === filterRes;

  const resOrders = useMemo(
    () => orders.filter((p) => byRes(p.resellerId) && inRange(p.tgl)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, filterRes, periode]
  );
  const st = statsOf(resOrders);
  const todayOrders = orders.filter((p) => byRes(p.resellerId) && isToday(p.tgl));
  const today = statsOf(todayOrders);
  // Harga reseller = harga jual dari Stok barang (sama seperti Rekapan Pesanan baru mode Reseller)
  const jualRes = useMemo(() => nilaiJual(state, resOrders), [state, resOrders]);
  // Laba = Transfer − ongkir − karantina − operasional − harga reseller
  const labaRes = st.transfer - st.ongkir - st.karantina - st.ops - jualRes;
  const marginRes = pct(labaRes, st.transfer - st.ongkir - st.karantina);
  const modalPct = pct(jualRes, st.transfer);
  const returF = returs.filter((r) => byRes(r.resellerId) && inRange(r.tgl));
  const rusakF = rusakRes.filter((r) => byRes(r.resellerId || "") && inRange(r.tgl));

  const hasTrx = (id: string) =>
    orders.some((p) => p.resellerId === id) || returs.some((r) => r.resellerId === id) || rusakRes.some((r) => r.resellerId === id);

  // ---- Kelola reseller ----
  function resetForm() {
    setEditId(null);
    setNama("");
    setHp("");
    setCat("");
  }

  function simpanReseller() {
    const n = nama.trim();
    if (!n) {
      toast.show("Nama reseller wajib diisi");
      return;
    }
    if (resellers.some((r) => r.id !== editId && r.nama.trim().toLowerCase() === n.toLowerCase())) {
      toast.show("Nama reseller sudah ada");
      return;
    }
    if (editId) {
      setState((s) => ({
        ...s,
        resellers: (s.resellers || []).map((r) => (r.id === editId ? { ...r, nama: n, hp: normalizeWA(hp), cat: cat.trim() } : r)),
        pesananReseller: (s.pesananReseller || []).map((p) => (p.resellerId === editId ? { ...p, resellerNama: n } : p)),
      }));
      toast.show("Reseller diperbarui");
    } else {
      const r: Reseller = { id: uid(), nama: n, hp: normalizeWA(hp), cat: cat.trim(), aktif: true };
      setState((s) => ({ ...s, resellers: [r, ...(s.resellers || [])] }));
      toast.show("Reseller ditambahkan");
    }
    resetForm();
  }

  function mulaiEdit(r: Reseller) {
    setEditId(r.id);
    setNama(r.nama);
    setHp(r.hp);
    setCat(r.cat);
    setConfirmDel(null);
  }

  function hapusReseller(id: string) {
    setState((s) => ({ ...s, resellers: (s.resellers || []).filter((r) => r.id !== id) }));
    setConfirmDel(null);
    toast.show("Reseller dihapus");
  }

  function setAktif(id: string, aktif: boolean) {
    setState((s) => ({ ...s, resellers: (s.resellers || []).map((r) => (r.id === id ? { ...r, aktif } : r)) }));
    setConfirmDel(null);
    toast.show(aktif ? "Reseller diaktifkan" : "Reseller dinonaktifkan");
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/dashboard"));

  if (!loaded) {
    return (
      <Screen title="Reseller" subtitle="Laporan penjualan reseller" onBack={back} floatingNav={false}>
        <ActivityIndicator color={colors.brandPrimary} testID="reseller-loading" />
      </Screen>
    );
  }

  const retPohon = returF.reduce((a, r) => a + r.jml, 0);
  const rusPohon = rusakF.reduce((a, r) => a + r.jml, 0);

  return (
    <Screen title="Reseller" subtitle="Laporan penjualan reseller (terpisah dari penjualan utama)" onBack={back} floatingNav={false}>
      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        <ChipBtn label="Semua reseller" active={!filterRes} onPress={() => setFilterRes("")} testID="filter-res-all" />
        {resellers.map((r) => (
          <ChipBtn key={r.id} label={r.nama + (r.aktif === false ? " (nonaktif)" : "")} active={filterRes === r.id} onPress={() => setFilterRes(r.id)} testID={`filter-res-${r.id}`} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        {PERIODE.map((p) => (
          <ChipBtn key={p.k} label={p.l} active={periode === p.k} onPress={() => setPeriode(p.k)} testID={`res-periode-${p.k}`} />
        ))}
      </ScrollView>

      {/* 1. Ringkasan hari ini (data dari Performa Finansial Reseller) */}
      <LinearGradient
        colors={[colors.brandPrimary, colors.brandDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
        testID="res-hari-ini"
      >
        <View style={styles.heroHead}>
          <View style={styles.heroIcon}>
            <Ionicons name="sunny-outline" size={18} color={colors.onBrandPrimary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroTitle}>Ringkasan hari ini · Reseller</Text>
            <Text style={styles.heroDate} numberOfLines={1}>{formatTgl(new Date().toISOString())}</Text>
          </View>
        </View>
        <View style={styles.heroRow}>
          <View style={styles.heroCell}>
            <Text style={styles.heroLbl}>Penjualan</Text>
            <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} testID="res-hari-penjualan">
              {formatRp(st.transfer)}
            </Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroCell}>
            <Text style={styles.heroLbl}>Keuntungan</Text>
            <Text
              style={[styles.heroVal, labaRes < 0 && { color: colors.accentMuted }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              testID="res-hari-untung"
            >
              {formatRp(labaRes)}
            </Text>
          </View>
        </View>
        <View style={styles.heroLine} />
        <Text style={styles.heroFoot} numberOfLines={1}>
          {today.jml} pesanan · {today.pohon} pohon keluar
        </Text>
      </LinearGradient>

      {/* 2. Performa finansial */}
      <View style={styles.card} testID="res-performa">
        <View style={styles.finHead}>
          <View style={styles.finIcon}>
            <Ionicons name="cash-outline" size={16} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.finTitle}>Performa Finansial Reseller</Text>
            <Text style={styles.finSub}>Akumulasi pesanan reseller</Text>
          </View>
        </View>
        <View style={[styles.finRow, { marginTop: spacing.md }]}>
          <View style={styles.finBox} testID="res-modal">
            <View style={styles.finBoxHead}>
              <Text style={styles.finLbl}>Harga Reseller</Text>
              <View style={styles.pctPill}>
                <Text style={styles.pctText}>{modalPct.toFixed(1)}%</Text>
              </View>
            </View>
            <Text style={styles.finVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatRp(jualRes)}</Text>
            <Text style={styles.finNote} numberOfLines={1}>Harga jual Stok barang</Text>
          </View>
          <View style={[styles.finBox, { alignItems: "flex-end" }]} testID="res-omzet">
            <Text style={styles.finLbl}>Total Penjualan</Text>
            <Text style={styles.finVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatRp(st.transfer)}</Text>
            <Text style={styles.finNote} numberOfLines={1}>Total customer transfer</Text>
          </View>
        </View>
        <View style={styles.finRow}>
          <MiniBox label="Ongkir" val={st.ongkir} note="Pengiriman" />
          <MiniBox label="Karantina" val={st.karantina} note="Uji tanaman" />
          <MiniBox label="Operasional" val={st.ops} note="Perlengkapan" />
        </View>
        <View style={[styles.labaBox, labaRes < 0 && styles.labaBoxNeg]} testID="res-laba">
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              <Text style={[styles.labaLbl, labaRes < 0 && { color: colors.accent }]}>Laba Bersih (Profit)</Text>
              <View style={styles.marginPill}>
                <Text style={[styles.marginText, labaRes < 0 && { color: colors.accent }]} testID="res-margin">
                  {marginRes >= 0 ? "+" : ""}
                  {marginRes.toFixed(1)}% Margin
                </Text>
              </View>
            </View>
            <Text style={[styles.labaVal, labaRes < 0 && { color: colors.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {formatRp(labaRes)}
            </Text>
          </View>
          <View style={styles.labaIcon}>
            <Ionicons name={labaRes < 0 ? "trending-down" : "trending-up"} size={20} color={labaRes < 0 ? colors.accent : colors.brandPrimary} />
          </View>
        </View>
      </View>

      {/* Pesanan & barang keluar */}
      <Card testID="res-pesanan-keluar">
        <Text style={styles.cardTitle}>Pesanan & barang keluar</Text>
        <Row k="Jumlah pesanan" v={String(st.jml)} />
        <Row k="Pohon keluar" v={String(st.pohon)} testID="res-pohon-keluar" />
        <Row k="Pohon retur (masuk)" v={String(retPohon)} testID="res-pohon-retur" />
        <Row k="Pohon rusak" v={String(rusPohon)} testID="res-pohon-rusak" />
        <Row k="Total harga jual keluar" v={formatRp(jualRes)} testID="res-jual-keluar" />
      </Card>

      {/* 3. Kelola reseller */}
      <Button
        title={kelola ? "Tutup daftar reseller" : "Kelola daftar reseller"}
        icon="people-outline"
        kind="alt"
        onPress={() => {
          setKelola((v) => !v);
          resetForm();
        }}
        testID="kelola-reseller"
      />
      {kelola && (
        <Card testID="kelola-panel">
          <Text style={styles.cardTitle}>{editId ? "Edit reseller" : "Tambah reseller"}</Text>
          <Field label="Nama" required>
            <Input value={nama} onChangeText={setNama} testID="res-nama" />
          </Field>
          <Field label="No WhatsApp">
            <Input prefix="+62" value={hp.replace(/^62/, "")} onChangeText={setHp} keyboardType="phone-pad" testID="res-hp" />
          </Field>
          <Field label="Catatan">
            <Input value={cat} onChangeText={setCat} testID="res-cat" />
          </Field>
          <Button title={editId ? "Simpan perubahan" : "Tambah reseller"} icon="checkmark" onPress={simpanReseller} testID="res-simpan" />
          {editId && <Button title="Batal edit" kind="ghost" onPress={resetForm} testID="res-batal-edit" />}
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {resellers.length === 0 && <Text style={styles.muted}>Belum ada reseller</Text>}
            {resellers.map((r) => (
              <View key={r.id} style={styles.resRow} testID={`res-row-${r.id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resName}>{r.nama}{r.aktif === false ? " · nonaktif" : ""}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{r.hp ? `+${r.hp}` : "Tanpa nomor"}{r.cat ? ` · ${r.cat}` : ""}</Text>
                  </View>
                  <Pressable onPress={() => mulaiEdit(r)} hitSlop={8} style={styles.iconBtn} testID={`res-edit-${r.id}`}>
                    <Ionicons name="pencil-outline" size={16} color={colors.muted} />
                  </Pressable>
                  <Pressable onPress={() => setConfirmDel(r.id)} hitSlop={8} style={styles.iconBtn} testID={`res-hapus-${r.id}`}>
                    <Ionicons name="trash-outline" size={16} color={colors.accent} />
                  </Pressable>
                </View>
                {confirmDel === r.id && (
                  <View style={styles.confirm} testID={`res-confirm-${r.id}`}>
                    {hasTrx(r.id) ? (
                      <>
                        <Text style={styles.confirmText}>Reseller ini sudah punya transaksi, jadi tidak bisa dihapus. {r.aktif === false ? "Aktifkan lagi?" : "Nonaktifkan saja?"}</Text>
                        <View style={styles.btnRow}>
                          <Button title="Batal" kind="alt" onPress={() => setConfirmDel(null)} style={{ flex: 1 }} testID={`res-confirm-batal-${r.id}`} />
                          <Button
                            title={r.aktif === false ? "Aktifkan" : "Nonaktifkan"}
                            kind="danger"
                            onPress={() => setAktif(r.id, r.aktif === false)}
                            style={{ flex: 1 }}
                            testID={`res-nonaktif-${r.id}`}
                          />
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.confirmText}>Hapus reseller {r.nama}?</Text>
                        <View style={styles.btnRow}>
                          <Button title="Batal" kind="alt" onPress={() => setConfirmDel(null)} style={{ flex: 1 }} testID={`res-confirm-batal-${r.id}`} />
                          <Button title="Hapus" kind="danger" onPress={() => hapusReseller(r.id)} style={{ flex: 1 }} testID={`res-hapus-ya-${r.id}`} />
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        </Card>
      )}

    </Screen>
  );
}

function ChipBtn({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} testID={testID}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Row({ k, v, danger, testID }: { k: string; v: string; danger?: boolean; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={[styles.rowVal, danger && { color: colors.accent }]} testID={testID}>{v}</Text>
    </View>
  );
}

function MiniBox({ label, val, note }: { label: string; val: number; note: string }) {
  return (
    <View style={[styles.finBox, styles.miniBox]}>
      <Text style={styles.finLbl} numberOfLines={1}>{label}</Text>
      <Text style={styles.miniVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatRp(val)}</Text>
      <Text style={styles.finNote} numberOfLines={1}>{note}</Text>
    </View>
  );
}

const tabular = { fontVariant: ["tabular-nums" as const] };
const W = "rgba(255,255,255,";
const styles = StyleSheet.create({
  chipRow: { flexGrow: 0, height: 56 },
  chipRowContent: { gap: spacing.sm, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted },
  chipTextActive: { color: colors.onBrandPrimary },
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
  finHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  finIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  finTitle: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  finSub: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
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
  labaIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.sm },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.sm + 1 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: spacing.sm },
  rowKey: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base, flexShrink: 1 },
  rowVal: { fontFamily: fonts.bold, color: colors.onSurface, fontSize: fontSize.base },
  resRow: { padding: spacing.md, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  resName: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  confirm: { marginTop: spacing.sm, padding: spacing.md, borderRadius: 14, backgroundColor: colors.accentMuted, gap: spacing.sm },
  confirmText: { fontFamily: fonts.medium, fontSize: fontSize.sm + 1, color: colors.onAccentMuted },
  btnRow: { flexDirection: "row", gap: spacing.sm },
});
