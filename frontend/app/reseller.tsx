import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "@/src/components/screen";
import { Button, Card, Field, Input } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import type { Reseller, ReturReseller, Rusak } from "@/src/store/types";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatRp, formatTgl, todayISO, uid } from "@/src/utils/format";
import { hppKeluarFIFO, jenisList, sisaStok } from "@/src/utils/calc";
import { marginPerJenis, nilaiJual, statsOf } from "@/src/utils/reseller";
import { normalizeWA } from "@/src/utils/phone";

type Periode = "all" | "7" | "1m" | "3m" | "6m";
type Hist = "semua" | "jual" | "retur" | "rusak";
type Mode = "retur" | "rusak" | null;

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
  const [hist, setHist] = useState<Hist>("semua");
  const [kelola, setKelola] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [hp, setHp] = useState("");
  const [cat, setCat] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [confirmHist, setConfirmHist] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [mRes, setMRes] = useState("");
  const [mJenis, setMJenis] = useState("");
  const [mJml, setMJml] = useState("");
  const [mKet, setMKet] = useState("");

  const resellers = state.resellers || [];
  const orders = state.pesananReseller || [];
  const returs = state.returReseller || [];
  const rusakRes = (state.rusak || []).filter((r) => r.resellerId);
  const nameOf = (id?: string) => resellers.find((r) => r.id === id)?.nama || "Reseller";

  const start = startOf(periode);
  const inRange = (tgl: string) => start === null || new Date(tgl).getTime() >= start;
  const byRes = (id: string) => !filterRes || id === filterRes;

  const resOrders = useMemo(
    () => orders.filter((p) => byRes(p.resellerId) && inRange(p.tgl)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, filterRes, periode]
  );
  const mainOrders = useMemo(
    () => state.pesanan.filter((p) => inRange(p.tgl)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.pesanan, periode]
  );
  const st = statsOf(resOrders);
  const today = statsOf(orders.filter((p) => byRes(p.resellerId) && isToday(p.tgl)));
  const mpj = useMemo(() => marginPerJenis(state, resOrders, mainOrders), [state, resOrders, mainOrders]);
  const jualRes = useMemo(() => nilaiJual(state, resOrders), [state, resOrders]);
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

  // ---- Retur & rusak ----
  const soldTo = (rid: string, jenis: string) =>
    orders.filter((p) => p.resellerId === rid).reduce((a, p) => a + p.items.filter((i) => i.jenis === jenis).reduce((x, i) => x + i.jml, 0), 0);
  const returnedFrom = (rid: string, jenis: string) =>
    returs.filter((r) => r.resellerId === rid && r.jenis === jenis).reduce((a, r) => a + r.jml, 0);
  const jenisRetur = mRes
    ? Array.from(new Set(orders.filter((p) => p.resellerId === mRes).flatMap((p) => p.items.map((i) => i.jenis))))
    : [];
  const jenisOpts = mode === "retur" ? jenisRetur : jenisList(state);
  const maxJml =
    mode === "retur" ? (mRes && mJenis ? soldTo(mRes, mJenis) - returnedFrom(mRes, mJenis) : 0) : mJenis ? sisaStok(state, mJenis) : 0;

  function bukaMode(m: Mode) {
    setMode(m);
    setMRes(filterRes || "");
    setMJenis("");
    setMJml("");
    setMKet("");
  }

  function simpanMode() {
    const q = Number(mJml);
    if (!mRes || !mJenis || !(q > 0) || !Number.isInteger(q)) {
      toast.show("Pilih reseller, jenis, dan isi jumlah pohon (bilangan bulat)");
      return;
    }
    if (q > maxJml) {
      toast.show(mode === "retur" ? `Maksimal retur ${maxJml} pohon (sisa yang dijual ke reseller ini)` : `Stok ${mJenis} hanya tersisa ${maxJml} pohon`);
      return;
    }
    if (mode === "retur") {
      const items = orders.filter((p) => p.resellerId === mRes).flatMap((p) => p.items.filter((i) => i.jenis === mJenis));
      const tot = items.reduce((a, i) => a + i.jml, 0);
      const hpp = tot > 0 ? Math.round(items.reduce((a, i) => a + i.hpp * i.jml, 0) / tot) : 0;
      const r: ReturReseller = { id: uid(), tgl: todayISO(), resellerId: mRes, jenis: mJenis, jml: q, hpp, ket: mKet.trim() };
      setState((s) => ({ ...s, returReseller: [r, ...(s.returReseller || [])] }));
      toast.show(`Retur ${q} pohon ${mJenis} dicatat, stok bertambah`);
    } else {
      const r: Rusak = { id: uid(), tgl: todayISO(), jenis: mJenis, jml: q, harga: hppKeluarFIFO(state, mJenis, q), ket: mKet.trim(), resellerId: mRes };
      setState((s) => ({ ...s, rusak: [r, ...(s.rusak || [])] }));
      toast.show(`Rusak ${q} pohon ${mJenis} dicatat`);
    }
    setMode(null);
  }

  // ---- Riwayat ----
  type Row = { id: string; tgl: string; kind: Exclude<Hist, "semua">; title: string; sub: string; val: string };
  const rows: Row[] = [
    ...(hist === "semua" || hist === "jual"
      ? resOrders.map((p) => ({
          id: p.id,
          tgl: p.tgl,
          kind: "jual" as const,
          title: p.resellerNama || nameOf(p.resellerId),
          sub: p.items.map((i) => `${i.jenis} x${i.jml}`).join(", "),
          val: formatRp(p.transfer),
        }))
      : []),
    ...(hist === "semua" || hist === "retur"
      ? returF.map((r) => ({ id: r.id, tgl: r.tgl, kind: "retur" as const, title: nameOf(r.resellerId), sub: `${r.jenis} +${r.jml}${r.ket ? ` · ${r.ket}` : ""}`, val: `+${r.jml} pohon` }))
      : []),
    ...(hist === "semua" || hist === "rusak"
      ? rusakF.map((r) => ({ id: r.id, tgl: r.tgl, kind: "rusak" as const, title: nameOf(r.resellerId), sub: `${r.jenis} −${r.jml}${r.ket ? ` · ${r.ket}` : ""}`, val: `−${r.jml} pohon` }))
      : []),
  ].sort((a, b) => new Date(b.tgl).getTime() - new Date(a.tgl).getTime());

  function hapusHist(row: Row) {
    if (row.kind === "jual") {
      const p = orders.find((x) => x.id === row.id);
      const bad = p ? p.items.find((it) => returnedFrom(p.resellerId, it.jenis) > soldTo(p.resellerId, it.jenis) - it.jml) : undefined;
      if (p && bad) {
        toast.show(`Tidak bisa dihapus: ${bad.jenis} sudah diretur. Hapus catatan returnya dulu.`);
        setConfirmHist(null);
        return;
      }
    }
    if (row.kind === "retur") {
      const r = returs.find((x) => x.id === row.id);
      if (r && sisaStok(state, r.jenis) < r.jml) {
        toast.show(`Tidak bisa dihapus: stok ${r.jenis} akan minus`);
        setConfirmHist(null);
        return;
      }
    }
    if (row.kind === "jual") setState((s) => ({ ...s, pesananReseller: (s.pesananReseller || []).filter((p) => p.id !== row.id) }));
    else if (row.kind === "retur") setState((s) => ({ ...s, returReseller: (s.returReseller || []).filter((r) => r.id !== row.id) }));
    else setState((s) => ({ ...s, rusak: (s.rusak || []).filter((r) => r.id !== row.id) }));
    setConfirmHist(null);
    toast.show("Catatan dihapus, stok dihitung ulang");
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

      {/* 1. Ringkasan hari ini */}
      <View style={styles.hero} testID="res-hari-ini">
        <Text style={styles.heroTitle}>Ringkasan hari ini · Reseller</Text>
        <View style={{ flexDirection: "row", marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLbl}>Penjualan</Text>
            <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit testID="res-hari-penjualan">{formatRp(today.omset)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLbl}>Keuntungan</Text>
            <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit testID="res-hari-untung">{formatRp(today.laba)}</Text>
          </View>
        </View>
        <Text style={[styles.heroLbl, { marginTop: spacing.sm }]}>{today.jml} pesanan · {today.pohon} pohon keluar</Text>
      </View>

      {/* 2. Performa finansial */}
      <Card testID="res-performa">
        <Text style={styles.cardTitle}>Performa Finansial Reseller</Text>
        <Row k="Omzet (harga reseller)" v={formatRp(st.omset)} testID="res-omzet" />
        <Row k="Total harga jual (Stok barang)" v={formatRp(jualRes)} testID="res-modal" />
        <Row k="Laba" v={formatRp(st.laba)} danger={st.laba < 0} testID="res-laba" />
        <Row k="Margin total (omzet − HPP − biaya)" v={`${st.margin.toFixed(1)}%`} danger={st.laba < 0} testID="res-margin" />
        <View style={styles.compare} testID="res-banding">
          <Text style={styles.compareTitle}>Margin rata-rata (dari harga jual Stok barang)</Text>
          <Row k="Reseller dapat" v={mpj.hasReseller ? `${mpj.avgReseller.toFixed(1)}%` : "-"} testID="res-avg-reseller" />
          <Row k="Penjualan utama" v={mpj.hasUtama ? `${mpj.avgUtama.toFixed(1)}%` : "-"} testID="res-avg-utama" />
          <Text style={styles.muted}>
            Reseller = (harga jual − harga reseller) ÷ harga jual. Utama = (harga jual − HPP) ÷ harga jual.
          </Text>
        </View>
        <Text style={[styles.compareTitle, { marginTop: spacing.md }]}>Margin % per jenis</Text>
        {mpj.rows.length === 0 ? (
          <Text style={styles.muted}>Belum ada penjualan</Text>
        ) : (
          <View testID="res-margin-jenis">
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, { flex: 1 }]}>Jenis</Text>
              <Text style={[styles.th, styles.num]}>Reseller</Text>
              <Text style={[styles.th, styles.num]}>Utama</Text>
            </View>
            {mpj.rows.map((r) => (
              <View key={r.jenis} style={styles.tr}>
                <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{r.jenis}</Text>
                <Text style={[styles.td, styles.num, r.reseller !== null && r.reseller < 0 && { color: colors.accent }]}>
                  {r.reseller === null ? "-" : `${r.reseller.toFixed(1)}%`}
                </Text>
                <Text style={[styles.td, styles.num]}>{r.utama === null ? "-" : `${r.utama.toFixed(1)}%`}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.muted, { marginTop: 6 }]}>Harga jual mengikuti harga terbaru di menu Stok barang. Jenis tanpa harga jual tampil "-".</Text>
      </Card>

      {/* Pesanan & barang keluar */}
      <Card testID="res-pesanan-keluar">
        <Text style={styles.cardTitle}>Pesanan & barang keluar</Text>
        <Row k="Jumlah pesanan" v={String(st.jml)} />
        <Row k="Pohon keluar" v={String(st.pohon)} testID="res-pohon-keluar" />
        <Row k="Pohon retur (masuk)" v={String(retPohon)} testID="res-pohon-retur" />
        <Row k="Pohon rusak" v={String(rusPohon)} testID="res-pohon-rusak" />
        <Row k="Total harga jual keluar" v={formatRp(jualRes)} testID="res-jual-keluar" />
        <Row k="Keuntungan" v={formatRp(st.laba)} danger={st.laba < 0} />
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

      {/* 4. Retur & rusak */}
      <View style={{ gap: spacing.sm }}>
        <Button title="Retur / Barang masuk" icon="arrow-undo-outline" kind="alt" onPress={() => bukaMode("retur")} testID="btn-retur" />
        <Button title="Barang rusak" icon="alert-circle-outline" kind="danger" onPress={() => bukaMode("rusak")} testID="btn-rusak-reseller" />
      </View>
      {mode && (
        <Card testID="mode-panel">
          <Text style={styles.cardTitle}>{mode === "retur" ? "Retur dari reseller (stok bertambah)" : "Barang rusak dari reseller (stok berkurang)"}</Text>
          <Text style={styles.lbl}>Reseller</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            {resellers.map((r) => (
              <ChipBtn key={r.id} label={r.nama} active={mRes === r.id} onPress={() => { setMRes(r.id); setMJenis(""); }} testID={`mode-res-${r.id}`} />
            ))}
          </ScrollView>
          <Text style={styles.lbl}>Jenis</Text>
          {jenisOpts.length === 0 ? (
            <Text style={styles.muted}>{mode === "retur" ? (mRes ? "Reseller ini belum punya penjualan" : "Pilih reseller dulu") : "Belum ada jenis"}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
              {jenisOpts.map((j) => (
                <ChipBtn key={j} label={j} active={mJenis === j} onPress={() => setMJenis(j)} testID={`mode-jenis-${j}`} />
              ))}
            </ScrollView>
          )}
          {mJenis ? (
            <Text style={styles.muted} testID="mode-max">
              {mode === "retur" ? `Maks. retur: ${maxJml} pohon` : `Stok tersedia: ${maxJml} pohon`}
            </Text>
          ) : null}
          <Field label="Jumlah pohon" required>
            <Input value={mJml} onChangeText={setMJml} keyboardType="number-pad" testID="mode-jml" />
          </Field>
          <Field label="Keterangan">
            <Input value={mKet} onChangeText={setMKet} testID="mode-ket" />
          </Field>
          <View style={styles.btnRow}>
            <Button title="Batal" kind="ghost" onPress={() => setMode(null)} style={{ flex: 1 }} testID="mode-batal" />
            <Button title="Simpan" icon="checkmark" kind={mode === "rusak" ? "danger" : "primary"} onPress={simpanMode} style={{ flex: 1 }} testID="mode-simpan" />
          </View>
        </Card>
      )}

      {/* 5. Riwayat */}
      <Card testID="res-riwayat">
        <Text style={styles.cardTitle}>Riwayat</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
          {(
            [
              ["semua", "Semua"],
              ["jual", "Penjualan"],
              ["retur", "Retur"],
              ["rusak", "Rusak"],
            ] as [Hist, string][]
          ).map(([k, l]) => (
            <ChipBtn key={k} label={l} active={hist === k} onPress={() => setHist(k)} testID={`hist-${k}`} />
          ))}
        </ScrollView>
        {rows.length === 0 && <Text style={styles.muted}>Belum ada catatan</Text>}
        <View style={{ gap: spacing.sm }}>
          {rows.map((r) => (
            <View key={r.kind + r.id} style={styles.resRow} testID={`hist-row-${r.id}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View style={[styles.kind, r.kind === "rusak" ? styles.kindRed : r.kind === "retur" ? styles.kindGreen : null]}>
                  <Text style={[styles.kindText, r.kind === "rusak" && { color: colors.accent }]}>
                    {r.kind === "jual" ? "Jual" : r.kind === "retur" ? "Retur" : "Rusak"}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resName} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{formatTgl(r.tgl)} · {r.sub}</Text>
                </View>
                <Text style={styles.histVal}>{r.val}</Text>
              </View>
              <View style={[styles.btnRow, { marginTop: 6 }]}>
                {r.kind === "jual" && (
                  <Pressable
                    onPress={() => router.push({ pathname: "/pesanan-baru", params: { id: r.id, src: "reseller" } })}
                    style={styles.linkBtn}
                    testID={`hist-edit-${r.id}`}
                  >
                    <Text style={styles.link}>Ubah</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setConfirmHist(r.id)} style={styles.linkBtn} testID={`hist-hapus-${r.id}`}>
                  <Text style={[styles.link, { color: colors.accent }]}>Hapus</Text>
                </Pressable>
              </View>
              {confirmHist === r.id && (
                <View style={styles.confirm}>
                  <Text style={styles.confirmText}>Hapus catatan ini? Stok akan dihitung ulang.</Text>
                  <View style={styles.btnRow}>
                    <Button title="Batal" kind="alt" onPress={() => setConfirmHist(null)} style={{ flex: 1 }} testID={`hist-batal-${r.id}`} />
                    <Button title="Hapus" kind="danger" onPress={() => hapusHist(r)} style={{ flex: 1 }} testID={`hist-hapus-ya-${r.id}`} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      </Card>
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
  hero: { backgroundColor: colors.brandPrimary, borderRadius: 24, padding: spacing.lg },
  heroTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onBrandPrimary },
  heroLbl: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: W + "0.8)" },
  heroVal: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onBrandPrimary },
  cardTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.sm },
  compare: { marginTop: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: colors.brandTertiary },
  compareTitle: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.brandPrimary, marginBottom: 4 },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.sm + 1 },
  lbl: { fontFamily: fonts.semibold, fontSize: fontSize.base - 1, color: colors.onSurface },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: spacing.sm },
  rowKey: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base, flexShrink: 1 },
  rowVal: { fontFamily: fonts.bold, color: colors.onSurface, fontSize: fontSize.base },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  thead: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: 6 },
  th: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  td: { fontFamily: fonts.medium, fontSize: fontSize.base - 1, color: colors.onSurface, paddingHorizontal: 6 },
  num: { width: 80, textAlign: "right" },
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
  kind: { height: 24, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.surfaceTertiary, justifyContent: "center" },
  kindRed: { backgroundColor: colors.accentMuted },
  kindGreen: { backgroundColor: colors.brandTertiary },
  kindText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brandPrimary },
  histVal: { fontFamily: fonts.bold, fontSize: fontSize.sm + 1, color: colors.onSurface },
  linkBtn: { minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  link: { fontFamily: fonts.semibold, fontSize: fontSize.sm + 1, color: colors.brandPrimary },
});
