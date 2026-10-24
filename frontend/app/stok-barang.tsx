import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "@/src/components/screen";
import { Button, Card, Field, Input, Picker } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import type { Belanja } from "@/src/store/types";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatRp, todayISO, uid } from "@/src/utils/format";
import { jenisList, stokFIFO } from "@/src/utils/calc";

const BARU = "__BARU__";
const KOSONG = "__KOSONG__";

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
  const [search, setSearch] = useState("");

  const allJenis = useMemo(() => jenisList(state), [state]);
  const totalHppLive = (Number(jml) || 0) * (Number(hpp) || 0);
  const effectiveJenis = jenis === BARU ? newJenis.trim() : jenis;
  const supId = sup && sup !== KOSONG ? sup : "";

  const willMerge = useMemo(() => {
    if (!effectiveJenis || !hpp) return null;
    return state.belanja.find(
      (b) =>
        b.jenis.toLowerCase() === effectiveJenis.toLowerCase() &&
        b.harga === Number(hpp) &&
        (b.sup || "") === supId
    );
  }, [state.belanja, effectiveJenis, hpp, supId]);

  const fifo = useMemo(() => stokFIFO(state), [state]);

  function simpan() {
    const j = effectiveJenis;
    const h = Number(hpp);
    const q = Number(jml);
    const jl = Number(jual) || 0;
    if (!j || q <= 0 || h <= 0) {
      toast.show("Lengkapi jenis, jumlah dan HPP");
      return;
    }
    if (willMerge) {
      setState((s) => ({
        ...s,
        belanja: s.belanja.map((b) =>
          b.id === willMerge.id ? { ...b, jml: b.jml + q, awal: b.awal + q } : b
        ),
      }));
      toast.show("Jumlah ditambahkan ke baris yang ada");
    } else {
      const b: Belanja = {
        id: uid(),
        tgl: todayISO(),
        jenis: j,
        sup: supId,
        jml: q,
        awal: q,
        harga: h,
        jual: jl,
      };
      setState((s) => ({ ...s, belanja: [b, ...s.belanja] }));
      toast.show("Stok barang ditambahkan");
    }
    setJml("");
    setHpp("");
    setJual("");
    if (jenis === BARU) {
      setJenis(j);
      setNewJenis("");
    }
  }

  function hapus(id: string) {
    setState((s) => ({ ...s, belanja: s.belanja.filter((b) => b.id !== id) }));
    toast.show("Baris dihapus");
  }

  const supOptions = [KOSONG, ...state.suppliers.map((s) => s.id)];
  const supLabel = (id: string) => (id === KOSONG ? "— tanpa supplier —" : state.suppliers.find((s) => s.id === id)?.nama || "?");

  const jenisOptions = [BARU, ...allJenis];
  const jenisLabel = (v: string) => (v === BARU ? "+ Jenis baru" : v);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.belanja;
    return state.belanja.filter((b) => {
      const sn = state.suppliers.find((s) => s.id === b.sup)?.nama || "";
      return (b.jenis + " " + sn).toLowerCase().includes(q);
    });
  }, [state.belanja, state.suppliers, search]);

  const totalRow = {
    jml: filtered.reduce((a, b) => a + b.jml, 0),
    awal: filtered.reduce((a, b) => a + b.awal, 0),
    now: filtered.reduce((a, b) => a + (fifo[b.id] ?? 0), 0),
    hpp: filtered.reduce((a, b) => a + b.harga * b.jml, 0),
  };

  return (
    <Screen
      title="Stok barang"
      subtitle="Catatan stok masuk & nilai HPP"
      onBack={() => router.back()}
      floatingNav={false}
    >
      <Card>
        <Text style={styles.cardTitle}>Tambah stok barang</Text>
        <View style={{ height: spacing.sm }} />
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
        <Field label="HPP (harga beli)" required>
          <Input value={hpp} onChangeText={setHpp} keyboardType="number-pad" testID="pers-hpp" />
        </Field>
        <Field label="Harga jual">
          <Input value={jual} onChangeText={setJual} keyboardType="number-pad" testID="pers-jual" />
        </Field>
        <Text style={styles.muted}>Total HPP: {formatRp(totalHppLive)}</Text>
        {willMerge && (
          <Text style={[styles.hint, { color: colors.brandPrimary }]}>
            Baris dengan jenis, HPP & supplier yang sama sudah ada — akan dijumlahkan ke baris itu.
          </Text>
        )}
        <View style={{ height: spacing.md }} />
        <Button title="Tambah stok barang" icon="add-outline" onPress={simpan} testID="pers-tambah" />
      </Card>

      <Input placeholder="Cari jenis atau supplier" value={search} onChangeText={setSearch} />

      <Card>
        <Text style={styles.cardTitle}>Data stok barang</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, styles.cJenis]}>Jenis</Text>
              <Text style={[styles.th, styles.cSupplier]}>Supplier</Text>
              <Text style={[styles.th, styles.cHPP]}>HPP</Text>
              <Text style={[styles.th, styles["cHarga jual"]]}>Harga jual</Text>
              <Text style={[styles.th, styles.cJml]}>Jml</Text>
              <Text style={[styles.th, styles.cAwal]}>Awal</Text>
              <Text style={[styles.th, styles.cSekarang]}>Sekarang</Text>
              <Text style={[styles.th, styles["cTotal HPP"]]}>Total HPP</Text>
              <Text style={[styles.th, styles.c__]} />
            </View>
            {filtered.map((b) => {
              const sn = state.suppliers.find((s) => s.id === b.sup)?.nama || "-";
              return (
                <View key={b.id} style={styles.tr}>
                  <Text style={[styles.td, styles.cJenis]} numberOfLines={1}>{b.jenis}</Text>
                  <Text style={[styles.td, styles.cSupplier]} numberOfLines={1}>{sn}</Text>
                  <Text style={[styles.td, styles.cHPP]}>{formatRp(b.harga)}</Text>
                  <Text style={[styles.td, styles["cHarga jual"]]}>{formatRp(b.jual)}</Text>
                  <Text style={[styles.td, styles.cJml]}>{b.jml}</Text>
                  <Text style={[styles.td, styles.cAwal]}>{b.awal}</Text>
                  <Text style={[styles.td, styles.cSekarang]}>{fifo[b.id] ?? 0}</Text>
                  <Text style={[styles.td, styles["cTotal HPP"]]}>{formatRp(b.harga * b.jml)}</Text>
                  <Pressable onPress={() => hapus(b.id)} style={styles.c__}>
                    <Ionicons name="trash-outline" size={16} color={colors.accent} />
                  </Pressable>
                </View>
              );
            })}
            {filtered.length > 0 && (
              <View style={[styles.tr, styles.ttotal]}>
                <Text style={[styles.td, styles.cJenis, styles.tdBold]}>Total</Text>
                <Text style={[styles.td, styles.cSupplier]} />
                <Text style={[styles.td, styles.cHPP]} />
                <Text style={[styles.td, styles["cHarga jual"]]} />
                <Text style={[styles.td, styles.cJml, styles.tdBold]}>{totalRow.jml}</Text>
                <Text style={[styles.td, styles.cAwal, styles.tdBold]}>{totalRow.awal}</Text>
                <Text style={[styles.td, styles.cSekarang, styles.tdBold]}>{totalRow.now}</Text>
                <Text style={[styles.td, styles["cTotal HPP"], styles.tdBold]}>{formatRp(totalRow.hpp)}</Text>
                <View style={styles.c__} />
              </View>
            )}
          </View>
        </ScrollView>
      </Card>
    </Screen>
  );
}

const COL = {
  cJenis: 110,
  cSupplier: 110,
  cHPP: 90,
  "cHarga jual": 100,
  cJml: 50,
  cAwal: 50,
  cSekarang: 70,
  "cTotal HPP": 110,
  c__: 36,
};

const styles = StyleSheet.create({
  cardTitle: { fontFamily: fonts.display, fontSize: fontSize.xl - 2, color: colors.onSurface },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base - 1 },
  hint: { fontFamily: fonts.medium, fontSize: fontSize.sm, marginTop: 4 },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.divider },
  thead: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: 4 },
  th: { fontFamily: fonts.bold, color: colors.onSurfaceTertiary, fontSize: fontSize.sm, paddingHorizontal: 4 },
  td: { fontFamily: fonts.medium, color: colors.onSurface, fontSize: fontSize.base - 1, paddingHorizontal: 4 },
  tdBold: { fontFamily: fonts.bold },
  ttotal: { backgroundColor: colors.brandTertiary },
  cJenis: { width: COL.cJenis },
  cSupplier: { width: COL.cSupplier },
  cHPP: { width: COL.cHPP },
  "cHarga jual": { width: COL["cHarga jual"] },
  cJml: { width: COL.cJml, textAlign: "right" },
  cAwal: { width: COL.cAwal, textAlign: "right" },
  cSekarang: { width: COL.cSekarang, textAlign: "right" },
  "cTotal HPP": { width: COL["cTotal HPP"], textAlign: "right" },
  c__: { width: COL.c__, alignItems: "center" },
});
