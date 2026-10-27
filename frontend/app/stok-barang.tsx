import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/src/components/screen";
import { Button, Field, Input, Picker } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import type { Belanja, Rusak } from "@/src/store/types";
import { colors, fonts, fontSize, radius, shadow, spacing } from "@/src/theme";
import { formatRp, formatTgl, todayISO, uid, ymd } from "@/src/utils/format";
import { hppKeluarFIFO, jenisList, pct, sisaStok, stokFIFO } from "@/src/utils/calc";
import { exportSheet } from "@/src/utils/excel";

const BARU = "__BARU__";
const KOSONG = "__KOSONG__";
type Tab = "semua" | "masuk" | "rusak";

export default function PersediaanScreen() {
  const { state, setState } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [jenis, setJenis] = useState<string>("");
  const [newJenis, setNewJenis] = useState("");
  const [sup, setSup] = useState<string>("");
  const [jml, setJml] = useState("");
  const [hpp, setHpp] = useState("");
  const [jual, setJual] = useState("");
  const [ket, setKet] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("semua");
  const [sumber, setSumber] = useState<"all" | "utama" | "reseller">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Belanja | null>(null);
  const [editingRusak, setEditingRusak] = useState<Rusak | null>(null);

  const allJenis = useMemo(() => jenisList(state), [state]);
  const fifo = useMemo(() => stokFIFO(state), [state]);
  const rusakList = useMemo(() => state.rusak || [], [state.rusak]);
  const supName = (id: string) => state.suppliers.find((s) => s.id === id)?.nama || "";

  const totalHppLive = (Number(jml) || 0) * (Number(hpp) || 0);
  const effectiveJenis = jenis === BARU ? newJenis.trim() : jenis;
  const supId = sup && sup !== KOSONG ? sup : "";
  const sisaJenis = jenis && jenis !== BARU ? sisaStok(state, jenis) : null;

  const willMerge = useMemo(() => {
    if (!effectiveJenis || !hpp) return null;
    return state.belanja.find(
      (b) => b.jenis.toLowerCase() === effectiveJenis.toLowerCase() && b.harga === Number(hpp) && (b.sup || "") === supId
    );
  }, [state.belanja, effectiveJenis, hpp, supId]);

  function resetForm() {
    setJml("");
    setHpp("");
    setJual("");
    setKet("");
  }

  // Tambah: Stok = Stok + Jumlah masuk
  function simpan() {
    const j = effectiveJenis;
    const h = Number(hpp);
    const q = Number(jml);
    const jl = Number(jual) || 0;
    if (!j || q <= 0 || h <= 0) {
      toast.show("Lengkapi jenis, jumlah dan HPP");
      return;
    }
    if (!Number.isInteger(q)) {
      toast.show("Jumlah pohon harus bilangan bulat");
      return;
    }
    if (willMerge) {
      setState((s) => ({
        ...s,
        belanja: s.belanja.map((b) => (b.id === willMerge.id ? { ...b, jml: b.jml + q, awal: b.awal + q } : b)),
      }));
      toast.show("Jumlah ditambahkan ke baris yang ada");
    } else {
      const b: Belanja = { id: uid(), tgl: todayISO(), jenis: j, sup: supId, jml: q, awal: q, harga: h, jual: jl };
      setState((s) => ({ ...s, belanja: [b, ...s.belanja] }));
      toast.show("Stok barang ditambahkan");
    }
    resetForm();
    if (jenis === BARU) {
      setJenis(j);
      setNewJenis("");
    }
    setTab("masuk");
  }

  // Kurangi: Sisa = Sisa − Jumlah rusak
  function kurangi() {
    const q = Number(jml);
    if (!jenis || jenis === BARU || q <= 0) {
      toast.show("Pilih jenis yang ada dan isi jumlah pohon");
      return;
    }
    if (!Number.isInteger(q)) {
      toast.show("Jumlah pohon harus bilangan bulat");
      return;
    }
    const sisa = sisaStok(state, jenis);
    if (q > sisa) {
      toast.show(`Stok ${jenis} hanya tersisa ${sisa} pohon`);
      return;
    }
    const r: Rusak = { id: uid(), tgl: todayISO(), jenis, jml: q, harga: hppKeluarFIFO(state, jenis, q), ket: ket.trim() };
    setState((s) => ({ ...s, rusak: [r, ...(s.rusak || [])] }));
    toast.show(`Stok ${jenis} dikurangi ${q} pohon (rusak)`);
    resetForm();
    setTab("rusak");
  }

  const supOptions = [KOSONG, ...state.suppliers.map((s) => s.id)];
  const supLabel = (id: string) => (id === KOSONG ? "— tanpa supplier —" : supName(id) || "?");
  const jenisOptions = [BARU, ...allJenis];
  const jenisLabel = (v: string) => (v === BARU ? "+ Jenis baru" : v);

  const q = search.trim().toLowerCase();
  const resNama = (id?: string) => (state.resellers || []).find((r) => r.id === id)?.nama || "Reseller";
  const masukList =
    sumber === "reseller"
      ? []
      : q
        ? state.belanja.filter((b) => (b.jenis + " " + supName(b.sup)).toLowerCase().includes(q))
        : state.belanja;
  const returFiltered =
    sumber === "utama"
      ? []
      : (state.returReseller || []).filter((r) => !q || (r.jenis + " " + resNama(r.resellerId) + " " + (r.ket || "")).toLowerCase().includes(q));
  const rusakFiltered = rusakList
    .filter((r) => (sumber === "all" ? true : sumber === "reseller" ? !!r.resellerId : !r.resellerId))
    .filter((r) => !q || (r.jenis + " " + (r.ket || "") + " " + (r.resellerId ? resNama(r.resellerId) : "")).toLowerCase().includes(q));

  const summary = useMemo(() => {
    let tersedia = 0;
    let hppTersedia = 0;
    for (const b of state.belanja) {
      const now = fifo[b.id] ?? 0;
      tersedia += now;
      hppTersedia += now * b.harga;
    }
    const rusak = rusakList.reduce((a, r) => a + r.jml, 0);
    const hppRusak = rusakList.reduce((a, r) => a + r.jml * r.harga, 0);
    return { tersedia, hppTersedia, rusak, hppRusak };
  }, [state.belanja, fifo, rusakList]);

  const showMasuk = tab !== "rusak";
  const showRusak = tab !== "masuk";
  const itemCount = (showMasuk ? masukList.length + returFiltered.length : 0) + (showRusak ? rusakFiltered.length : 0);

  async function download() {
    if (itemCount === 0) {
      toast.show("Belum ada data stok untuk diunduh");
      return;
    }
    const aoa: (string | number)[][] = [["Tipe", "Tanggal", "Jenis", "Supplier/Keterangan", "Stok awal", "Jumlah", "Sisa", "HPP", "Harga jual", "Total HPP"]];
    if (showMasuk)
      masukList.forEach((b) =>
        aoa.push(["Masuk", b.tgl.slice(0, 10), b.jenis, supName(b.sup) || "-", b.awal, b.jml, fifo[b.id] ?? 0, b.harga, b.jual, b.harga * b.jml])
      );
    if (showMasuk)
      returFiltered.forEach((r) =>
        aoa.push(["Retur reseller", r.tgl.slice(0, 10), r.jenis, resNama(r.resellerId) + (r.ket ? ` · ${r.ket}` : ""), "", r.jml, "", r.hpp, "", r.hpp * r.jml])
      );
    if (showRusak)
      rusakFiltered.forEach((r) =>
        aoa.push(["Rusak", r.tgl.slice(0, 10), r.jenis, r.ket || "-", "", -r.jml, "", r.harga, "", -r.harga * r.jml])
      );
    try {
      await exportSheet(aoa, "Stok", `Stok_Barang_${ymd(new Date())}.xlsx`);
      toast.show("File Excel stok dibuat");
    } catch {
      toast.show("Gagal membuat file");
    }
  }

  const tabs: { k: Tab; l: string; dot?: string }[] = [
    { k: "semua", l: `Semua (${masukList.length + returFiltered.length + rusakFiltered.length})` },
    { k: "masuk", l: `Masuk (${masukList.length + returFiltered.length})`, dot: colors.action },
    { k: "rusak", l: `Keluar/rusak (${rusakFiltered.length})`, dot: colors.accent },
  ];

  return (
    <Screen
      title="Stok barang"
      subtitle="Catatan stok masuk & nilai HPP"
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/dashboard"))}
      floatingNav={false}
    >
      {/* Ringkasan nilai HPP */}
      <View style={styles.card} testID="stok-ringkasan">
        <View style={styles.rowCenter}>
          <View style={[styles.dot, { backgroundColor: colors.action }]} />
          <Text style={styles.overline}>Ringkasan nilai HPP</Text>
          <View style={styles.pillGreen}>
            <Text style={styles.pillGreenText}>Aktif</Text>
          </View>
        </View>
        <View style={styles.sumRow}>
          <View style={styles.sumCell}>
            <Text style={styles.lbl} numberOfLines={1}>Total HPP Tersedia</Text>
            <Text style={styles.sumVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} testID="stok-hpp-tersedia">
              {formatRp(summary.hppTersedia)}
            </Text>
            <Text style={[styles.note, { color: colors.success }]}>Nilai modal aktif</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.sumCell}>
            <Text style={styles.lbl} numberOfLines={1}>Total HPP Keluar/rusak</Text>
            <Text
              style={[styles.sumVal, { color: colors.accent }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              testID="stok-hpp-rusak"
            >
              {formatRp(summary.hppRusak)}
            </Text>
            <Text style={[styles.note, { color: colors.accent }]}>Stok keluar/rusak</Text>
          </View>
        </View>
      </View>

      <View style={styles.statRow}>
        <StatBox label="Stok Tersedia" val={summary.tersedia} pos testID="stok-tersedia" />
        <StatBox label="Keluar (rusak)" val={summary.rusak} testID="stok-rusak" />
      </View>

      {/* Form stok persediaan (bisa diminimize) */}
      <View style={styles.card}>
        <Pressable onPress={() => setFormOpen((v) => !v)} style={styles.formHead} testID="toggle-form-stok">
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.formTitle} testID="stok-persediaan-title">Stok Persediaan</Text>
            <Text style={styles.lbl} numberOfLines={2}>
              {formOpen ? "Tambah stok masuk atau kurangi stok rusak" : "Form diminimize • Klik untuk membuka input stok"}
            </Text>
          </View>
          <View style={styles.toggleBtn}>
            <Text style={styles.toggleText}>{formOpen ? "Sembunyikan" : "Tampilkan"}</Text>
            <Ionicons name={formOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
          </View>
        </Pressable>

        {formOpen && (
          <View style={{ marginTop: spacing.lg }}>
            <Field label="Tanggal">
              <Input value={new Date().toLocaleDateString("id-ID")} editable={false} />
            </Field>
            <Field label="Jenis" required>
              <Picker
                value={jenis}
                options={jenisOptions as string[]}
                labelFor={jenisLabel}
                placeholder="Pilih jenis"
                onChange={(v) => setJenis(v)}
                testID="pers-picker-jenis"
              />
            </Field>
            {jenis === BARU && (
              <Field label="Nama jenis baru" required>
                <Input value={newJenis} onChangeText={setNewJenis} testID="pers-new-jenis" />
              </Field>
            )}
            <Field label="Supplier">
              <Picker
                value={sup}
                options={supOptions as string[]}
                labelFor={supLabel}
                placeholder="Pilih supplier"
                onChange={(v) => setSup(v)}
                testID="pers-picker-sup"
              />
            </Field>
            <Field label="Jumlah pohon" required>
              <Input value={jml} onChangeText={setJml} keyboardType="number-pad" testID="pers-jml" />
            </Field>
            {sisaJenis !== null && (
              <Text style={styles.hint} testID="pers-sisa-jenis">
                Stok {jenis} tersedia: {sisaJenis} pohon
              </Text>
            )}
            <Field label="HPP (harga beli)" required>
              <Input value={hpp} onChangeText={setHpp} keyboardType="number-pad" testID="pers-hpp" />
            </Field>
            <Field label="Harga jual">
              <Input value={jual} onChangeText={setJual} keyboardType="number-pad" testID="pers-jual" />
            </Field>
            <View style={styles.liveTotal}>
              <Text style={styles.lbl}>Total HPP</Text>
              <Text style={styles.liveTotalVal} testID="pers-total-hpp">{formatRp(totalHppLive)}</Text>
            </View>
            {willMerge && (
              <Text style={styles.hint}>Baris dengan jenis, HPP & supplier yang sama sudah ada — akan dijumlahkan ke baris itu.</Text>
            )}
            <Field label="Keterangan rusak (opsional, untuk Kurangi)">
              <Input value={ket} onChangeText={setKet} placeholder="mis. busuk akar" testID="pers-ket" />
            </Field>
            <Button title="Tambah stok barang" icon="add-outline" onPress={simpan} testID="pers-tambah" />
            <View style={{ height: spacing.sm }} />
            <Button title="Kurangi stok barang" icon="remove-outline" kind="danger" onPress={kurangi} testID="pers-kurangi" />
            <Text style={[styles.lbl, { marginTop: 6 }]}>Kurangi: pilih jenis + jumlah pohon rusak. HPP dihitung otomatis.</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.search}>
        <Ionicons name="search-outline" size={20} color={colors.muted} />
        <TextInput
          placeholder="Cari jenis barang..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          returnKeyType="search"
          testID="stok-search"
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={14} testID="stok-search-clear">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Data stok */}
      <View style={styles.card} testID="stok-list">
        <View style={styles.rowCenter}>
          <Text style={styles.listTitle} numberOfLines={1}>Data stok barang</Text>
          <View style={styles.countPill}>
            <Text style={styles.countText} testID="stok-item-count">{itemCount} Item</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={download} hitSlop={8} style={styles.dlBtn} testID="stok-download">
            <Text style={styles.dlText}>Download</Text>
            <Ionicons name="download-outline" size={16} color={colors.success} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
          {tabs.map((t) => {
            const active = tab === t.k;
            return (
              <Pressable key={t.k} onPress={() => setTab(t.k)} style={[styles.chip, active && styles.chipActive]} testID={`stok-tab-${t.k}`}>
                {t.dot && !active ? <View style={[styles.dotSm, { backgroundColor: t.dot }]} /> : null}
                <Text
                  style={[styles.chipText, !active && t.k === "rusak" && { color: colors.accent }, active && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {t.l}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
          {(
            [
              { k: "all", l: "Semua sumber" },
              { k: "utama", l: "Utama" },
              { k: "reseller", l: "Reseller" },
            ] as const
          ).map((s) => {
            const active = sumber === s.k;
            return (
              <Pressable key={s.k} onPress={() => setSumber(s.k)} style={[styles.chip, active && styles.chipActive]} testID={`stok-sumber-${s.k}`}>
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{s.l}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {itemCount === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={28} color={colors.muted} />
            <Text style={styles.lbl}>{q ? "Tidak ada data yang cocok" : "Belum ada data. Buka \"Stok Persediaan\" untuk mulai."}</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {showMasuk &&
              masukList.map((b) => (
                <MasukItem key={b.id} b={b} sisa={fifo[b.id] ?? 0} supplier={supName(b.sup) || "Tanpa supplier"} onEdit={() => setEditing(b)} />
              ))}
            {showMasuk &&
              returFiltered.map((r) => (
                <View key={r.id} style={styles.item} testID={`retur-item-${r.id}`}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.rowCenter}>
                        <View style={[styles.dot, { backgroundColor: colors.action }]} />
                        <Text style={styles.itemName} numberOfLines={1}>{r.jenis} (Retur)</Text>
                      </View>
                      <Text style={styles.itemSub} numberOfLines={1}>Dari {resNama(r.resellerId)}{r.ket ? ` · ${r.ket}` : ""}</Text>
                      <Text style={styles.itemSubLight} numberOfLines={1}>{formatTgl(r.tgl)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <View style={styles.srcBadge}>
                        <Text style={styles.srcText}>Reseller</Text>
                      </View>
                      <View style={[styles.pill, styles.pillOk]}>
                        <Text style={[styles.pillText, { color: colors.success }]}>+{r.jml} Pohon</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            {showRusak &&
              rusakFiltered.map((r) => (
                <RusakItem key={r.id} r={r} src={r.resellerId ? resNama(r.resellerId) : ""} onEdit={() => setEditingRusak(r)} />
              ))}
          </View>
        )}
      </View>

      <EditSheet
        item={editing}
        used={editing ? editing.jml - (fifo[editing.id] ?? 0) : 0}
        suppliers={state.suppliers}
        onClose={() => setEditing(null)}
        onInvalid={(m) => toast.show(m)}
        onSave={(next) => {
          setState((s) => ({ ...s, belanja: s.belanja.map((b) => (b.id === next.id ? next : b)) }));
          toast.show("Stok barang diperbarui");
          setEditing(null);
        }}
        onDelete={(id) => {
          const row = state.belanja.find((x) => x.id === id);
          const used = row ? row.jml - (fifo[row.id] ?? 0) : 0;
          if (used > 0) {
            toast.show(`Tidak bisa dihapus: ${used} pohon dari baris ini sudah terjual/rusak`);
            return;
          }
          setState((s) => ({ ...s, belanja: s.belanja.filter((b) => b.id !== id) }));
          toast.show("Baris stok dihapus");
          setEditing(null);
        }}
      />
      <RusakSheet
        item={editingRusak}
        onClose={() => setEditingRusak(null)}
        onDelete={(id) => {
          setState((s) => ({ ...s, rusak: (s.rusak || []).filter((r) => r.id !== id) }));
          toast.show("Catatan rusak dihapus, stok dikembalikan");
          setEditingRusak(null);
        }}
      />
    </Screen>
  );
}

function StatBox({ label, val, pos, testID }: { label: string; val: number; pos?: boolean; testID?: string }) {
  return (
    <View style={[styles.card, styles.statBox]} testID={testID}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.lbl} numberOfLines={1}>{label}</Text>
        <Text style={styles.statVal} numberOfLines={1}>
          <Text style={!pos && { color: colors.accent }}>{val}</Text>
          <Text style={styles.statUnit}> Pohon</Text>
        </Text>
      </View>
      <View style={[styles.statBadge, { backgroundColor: pos ? colors.brandTertiary : colors.accentMuted }]}>
        <Ionicons name={pos ? "checkmark" : "alert"} size={16} color={pos ? colors.action : colors.accent} />
      </View>
    </View>
  );
}

function MasukItem({ b, sisa, supplier, onEdit }: { b: Belanja; sisa: number; supplier: string; onEdit: () => void }) {
  const low = sisa <= 2;
  return (
    <View style={styles.item} testID={`stok-item-${b.id}`}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowCenter}>
            <View style={[styles.dot, { backgroundColor: low ? colors.warning : colors.action }]} />
            <Text style={styles.itemName} numberOfLines={1}>{b.jenis}</Text>
          </View>
          <Text style={styles.itemSub} numberOfLines={1}>{supplier}</Text>
          <Text style={styles.itemSubLight} numberOfLines={1}>Stok Awal: {b.awal} Pohon</Text>
          {b.hargaReseller ? (
            <View style={[styles.srcBadge, { alignSelf: "flex-start", marginLeft: 16, marginTop: 6 }]} testID={`stok-reseller-badge-${b.id}`}>
              <Text style={styles.srcText}>
                Reseller {formatRp(b.hargaReseller)} · margin {pct(b.hargaReseller - b.harga, b.hargaReseller).toFixed(0)}%
              </Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.pill, low ? styles.pillWarn : styles.pillOk]}>
          <Text style={[styles.pillText, { color: low ? colors.onWarning : colors.success }]} testID={`stok-sisa-${b.id}`}>
            Sisa: {sisa} Pohon
          </Text>
        </View>
      </View>
      <View style={styles.itemLine} />
      <View style={styles.rowCenter}>
        <Text style={styles.priceRow}>
          <Text style={styles.priceLbl}>HPP: </Text>
          <Text style={styles.priceVal}>{formatRp(b.harga)}</Text>
          <Text style={styles.priceLbl}>  •  Jual: </Text>
          <Text style={[styles.priceVal, { color: colors.success }]}>{b.jual ? formatRp(b.jual) : "-"}</Text>
        </Text>
        <Pressable onPress={onEdit} style={styles.editBtn} hitSlop={6} testID={`stok-edit-${b.id}`}>
          <Ionicons name="pencil-outline" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function RusakItem({ r, src, onEdit }: { r: Rusak; src: string; onEdit: () => void }) {
  return (
    <View style={styles.item} testID={`rusak-item-${r.id}`}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowCenter}>
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            <Text style={styles.itemName} numberOfLines={1}>{r.jenis} (Keluar)</Text>
          </View>
          <Text style={styles.itemSub} numberOfLines={1}>{r.ket || "Tanpa keterangan"}</Text>
          <Text style={styles.itemSubLight} numberOfLines={1}>{formatTgl(r.tgl)} · {src ? `Reseller: ${src}` : "Utama"}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={styles.tagRed}>
            <Text style={[styles.pillText, { color: colors.accent }]}>Rusak</Text>
          </View>
          <View style={[styles.pill, styles.pillRed]}>
            <Text style={[styles.pillText, { color: colors.accent }]} testID={`rusak-jml-${r.id}`}>Rusak: {r.jml} Pohon</Text>
          </View>
        </View>
      </View>
      <View style={styles.itemLine} />
      <View style={styles.rowCenter}>
        <Text style={styles.priceRow}>
          <Text style={styles.priceLbl}>HPP: </Text>
          <Text style={styles.priceVal}>{formatRp(r.harga)}</Text>
          <Text style={styles.priceLbl}>  •  Total: </Text>
          <Text style={[styles.priceVal, { color: colors.accent }]}>{formatRp(r.harga * r.jml)}</Text>
        </Text>
        <Pressable onPress={onEdit} style={styles.editBtn} hitSlop={6} testID={`rusak-edit-${r.id}`}>
          <Ionicons name="pencil-outline" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function Sheet({ visible, title, onClose, children, testID }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; testID: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable style={styles.scrim} onPress={onClose} testID={`${testID}-scrim`} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID={testID}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.editBtn} testID={`${testID}-close`}>
              <Ionicons name="close" size={18} color={colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ConfirmDelete({ label, onDelete, testPrefix }: { label: string; onDelete: () => void; testPrefix: string }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm)
    return (
      <Pressable onPress={() => setConfirm(true)} style={styles.deleteBtn} testID={`${testPrefix}-hapus`}>
        <Ionicons name="trash-outline" size={16} color={colors.accent} />
        <Text style={styles.deleteText}>{label}</Text>
      </Pressable>
    );
  return (
    <View style={styles.confirmBox}>
      <Text style={styles.confirmText}>Yakin hapus? Tindakan ini tidak bisa dibatalkan.</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button title="Batal" kind="alt" onPress={() => setConfirm(false)} style={{ flex: 1 }} testID={`${testPrefix}-hapus-batal`} />
        <Button title="Hapus" kind="danger" onPress={onDelete} style={{ flex: 1 }} testID={`${testPrefix}-hapus-ya`} />
      </View>
    </View>
  );
}

function EditSheet({
  item,
  used,
  suppliers,
  onClose,
  onSave,
  onDelete,
  onInvalid,
}: {
  item: Belanja | null;
  used: number;
  suppliers: { id: string; nama: string }[];
  onClose: () => void;
  onSave: (b: Belanja) => void;
  onDelete: (id: string) => void;
  onInvalid: (msg: string) => void;
}) {
  const [draft, setDraft] = useState({ jenis: "", sup: "", jml: "", harga: "", jual: "", hargaReseller: "" });
  const [lastId, setLastId] = useState<string | null>(null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setDraft({
      jenis: item.jenis,
      sup: item.sup || "",
      jml: String(item.jml),
      harga: String(item.harga),
      jual: item.jual ? String(item.jual) : "",
      hargaReseller: item.hargaReseller ? String(item.hargaReseller) : "",
    });
  }
  if (!item && lastId) setLastId(null);

  function save() {
    if (!item) return;
    const qn = Number(draft.jml);
    const h = Number(draft.harga);
    if (!draft.jenis.trim() || qn <= 0 || h <= 0) {
      onInvalid("Lengkapi jenis, jumlah dan HPP");
      return;
    }
    if (!Number.isInteger(qn)) {
      onInvalid("Jumlah pohon harus bilangan bulat");
      return;
    }
    if (qn < used) {
      onInvalid(`Jumlah minimal ${used} pohon (sudah terjual/rusak)`);
      return;
    }
    onSave({
      ...item,
      jenis: draft.jenis.trim(),
      sup: draft.sup,
      jml: qn,
      awal: Math.max(0, item.awal + (qn - item.jml)),
      harga: h,
      jual: Number(draft.jual) || 0,
      hargaReseller: Number(draft.hargaReseller) > 0 ? Number(draft.hargaReseller) : undefined,
    });
  }

  const hN = Number(draft.harga) || 0;
  const jN = Number(draft.jual) || 0;
  const rN = Number(draft.hargaReseller) || 0;

  const supChoices = [{ id: "", nama: "Tanpa supplier" }, ...suppliers];
  return (
    <Sheet visible={!!item} title="Edit stok barang" onClose={onClose} testID="edit-stok-sheet">
      <Field label="Jenis" required>
        <Input value={draft.jenis} onChangeText={(v) => setDraft((d) => ({ ...d, jenis: v }))} testID="edit-jenis" />
      </Field>
      <Text style={styles.fieldLbl}>Supplier</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        {supChoices.map((s) => {
          const active = draft.sup === s.id;
          return (
            <Pressable
              key={s.id || "none"}
              onPress={() => setDraft((d) => ({ ...d, sup: s.id }))}
              style={[styles.chip, active && styles.chipActive]}
              testID={`edit-sup-${s.id || "none"}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{s.nama}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Field label="Jumlah pohon" required>
        <Input value={draft.jml} onChangeText={(v) => setDraft((d) => ({ ...d, jml: v }))} keyboardType="number-pad" testID="edit-jml" />
      </Field>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Field label="HPP" required style={{ flex: 1, minWidth: 0 }}>
          <Input value={draft.harga} onChangeText={(v) => setDraft((d) => ({ ...d, harga: v }))} keyboardType="number-pad" testID="edit-hpp" />
        </Field>
        <Field label="Harga jual" style={{ flex: 1, minWidth: 0 }}>
          <Input value={draft.jual} onChangeText={(v) => setDraft((d) => ({ ...d, jual: v }))} keyboardType="number-pad" testID="edit-jual" />
        </Field>
      </View>
      <Field label="Harga Reseller (Rp)">
        <Input
          value={draft.hargaReseller}
          onChangeText={(v) => setDraft((d) => ({ ...d, hargaReseller: v }))}
          keyboardType="number-pad"
          placeholder="Kosong = pakai harga jual biasa"
          testID="edit-harga-reseller"
        />
      </Field>
      <View style={styles.detailBox} testID="edit-reseller-calc">
        {rN > 0 ? (
          <>
            <DetailRow k="Margin reseller" v={`${pct(rN - hN, rN).toFixed(1)}%`} />
            <DetailRow k="Margin normal" v={jN > 0 ? `${pct(jN - hN, jN).toFixed(1)}%` : "harga jual belum diisi"} />
            <DetailRow
              k="Selisih vs harga normal"
              v={jN > 0 ? `${pct(jN - rN, jN) >= 0 ? "lebih murah" : "lebih mahal"} ${Math.abs(pct(jN - rN, jN)).toFixed(1)}%` : "-"}
            />
            {rN < hN && (
              <Text style={[styles.deleteText, { fontSize: fontSize.sm, marginTop: 4 }]} testID="edit-reseller-warning">
                Harga reseller di bawah HPP — rugi per pohon {formatRp(hN - rN)}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.lbl}>Harga reseller belum diatur (dipakai harga jual biasa)</Text>
        )}
      </View>
      <View style={{ height: spacing.md }} />
      <Button title="Simpan perubahan" icon="checkmark" onPress={save} testID="edit-simpan" />
      {item && <ConfirmDelete key={item.id} label="Hapus baris stok" onDelete={() => onDelete(item.id)} testPrefix="edit" />}
    </Sheet>
  );
}

function RusakSheet({ item, onClose, onDelete }: { item: Rusak | null; onClose: () => void; onDelete: (id: string) => void }) {
  return (
    <Sheet visible={!!item} title="Detail stok rusak" onClose={onClose} testID="rusak-sheet">
      {item && (
        <>
          <View style={styles.detailBox}>
            <DetailRow k="Jenis" v={item.jenis} />
            <DetailRow k="Tanggal" v={formatTgl(item.tgl)} />
            <DetailRow k="Jumlah rusak" v={`${item.jml} pohon`} />
            <DetailRow k="HPP / pohon" v={formatRp(item.harga)} />
            <DetailRow k="Total HPP rusak" v={formatRp(item.harga * item.jml)} />
            <DetailRow k="Keterangan" v={item.ket || "-"} />
          </View>
          <Text style={[styles.lbl, { marginTop: spacing.sm }]}>Menghapus catatan ini mengembalikan {item.jml} pohon ke stok.</Text>
          <ConfirmDelete key={item.id} label="Hapus catatan rusak" onDelete={() => onDelete(item.id)} testPrefix="rusak" />
        </>
      )}
    </Sheet>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={[styles.rowCenter, { justifyContent: "space-between", paddingVertical: 4 }]}>
      <Text style={styles.lbl}>{k}</Text>
      <Text style={[styles.priceVal, { flexShrink: 1, textAlign: "right" }]} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const tabular = { fontVariant: ["tabular-nums" as const] };

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 24, padding: spacing.lg, ...shadow.card },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotSm: { width: 6, height: 6, borderRadius: 3 },
  overline: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", color: colors.onSurface },
  pillGreen: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  pillGreenText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.success },
  sumRow: { flexDirection: "row", marginTop: spacing.lg },
  sumCell: { flex: 1, minWidth: 0, gap: 4 },
  vDivider: { width: 1, backgroundColor: colors.divider, marginHorizontal: spacing.md },
  lbl: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.muted },
  sumVal: { fontFamily: fonts.bold, fontSize: fontSize.lg + 2, color: colors.onSurface, ...tabular },
  note: { fontFamily: fonts.medium, fontSize: 11 },

  statRow: { flexDirection: "row", gap: spacing.md },
  statBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md + 2 },
  statVal: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface, marginTop: 4, ...tabular },
  statUnit: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.muted },
  statBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  formHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
  formTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface, letterSpacing: -0.3, marginBottom: 4 },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexShrink: 0,
  },
  toggleText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted },
  liveTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.sm,
  },
  liveTotalVal: { fontFamily: fonts.bold, fontSize: fontSize.base + 1, color: colors.onSurface, ...tabular },
  hint: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.success, marginBottom: spacing.sm },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 24,
    ...shadow.card,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.onSurface, height: 52 },

  listTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg + 2, color: colors.onSurface, flexShrink: 1 },
  countPill: { height: 22, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: "center" },
  countText: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  dlBtn: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 },
  dlText: { fontFamily: fonts.semibold, fontSize: fontSize.sm + 1, color: colors.success },

  chipRow: { flexGrow: 0, height: 56 },
  chipRowContent: { gap: spacing.sm, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep },
  chipText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.muted },
  chipTextActive: { color: colors.onBrandPrimary },

  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },

  item: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md + 2 },
  itemTop: { flexDirection: "row", gap: spacing.sm },
  itemName: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface, flexShrink: 1 },
  itemSub: { fontFamily: fonts.body, fontSize: fontSize.sm + 1, color: colors.muted, marginTop: 4, marginLeft: 16 },
  itemSubLight: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.borderStrong, marginTop: 2, marginLeft: 16 },
  pill: { height: 26, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, justifyContent: "center", alignSelf: "flex-start" },
  pillOk: { backgroundColor: colors.brandTertiary, borderColor: colors.border },
  pillWarn: { backgroundColor: colors.surfaceSecondary, borderColor: colors.warning },
  pillRed: { backgroundColor: colors.accentMuted, borderColor: colors.accentMuted },
  pillText: { fontFamily: fonts.semibold, fontSize: 11, ...tabular },
  tagRed: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.accentMuted,
    justifyContent: "center",
    flexShrink: 0,
  },
  srcBadge: { height: 22, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.brandTertiary, justifyContent: "center" },
  srcText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brandPrimary, ...tabular },
  itemLine: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  priceRow: { flex: 1 },
  priceLbl: { fontFamily: fonts.body, fontSize: fontSize.sm + 1, color: colors.muted },
  priceVal: { fontFamily: fonts.semibold, fontSize: fontSize.sm + 1, color: colors.onSurface, ...tabular },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },

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
  fieldLbl: { fontFamily: fonts.semibold, fontSize: fontSize.base - 1, color: colors.onSurface },
  detailBox: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: spacing.md },
  deleteBtn: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
  deleteText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.accent },
  confirmBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: colors.accentMuted, gap: spacing.sm },
  confirmText: { fontFamily: fonts.medium, fontSize: fontSize.sm + 1, color: colors.onAccentMuted },
});
