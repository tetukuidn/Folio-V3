import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "@/src/components/screen";
import { Button, Card, Chip, Divider, Field, Input, Picker, SectionTitle } from "@/src/components/ui";
import { Rekapan } from "@/src/components/rekapan";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import type { Pesanan, PesananItem, StoreState } from "@/src/store/types";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatRp, formatTgl, todayISO, uid } from "@/src/utils/format";
import { hppJenis, jenisList, sisaStok, tagItems } from "@/src/utils/calc";
import { KURIR_NAMES, layananFor } from "@/src/utils/kurir";
import { normalizeWA } from "@/src/utils/phone";

const PAKET_KEY = "__PAKET__";

type Form = {
  nama: string;
  wa: string;
  alamat: string;
  kota: string;
  kec: string;
  kodepos: string;
  tgl: string;
  paket: boolean;
  items: PesananItem[];
  ongkir: string;
  karantina: string;
  ops: string;
  transfer: string;
  codOngkir: boolean;
  kurir: string;
  layanan: string;
  berat: string;
};

const emptyForm = (): Form => ({
  nama: "",
  wa: "",
  alamat: "",
  kota: "",
  kec: "",
  kodepos: "",
  tgl: todayISO(),
  paket: false,
  items: [],
  ongkir: "",
  karantina: "",
  ops: "",
  transfer: "",
  codOngkir: false,
  kurir: KURIR_NAMES[0],
  layanan: layananFor(KURIR_NAMES[0])[0],
  berat: "",
});

const formFromPesanan = (p: Pesanan): Form => ({
  nama: p.nama,
  wa: p.wa,
  alamat: p.alamat,
  kota: p.kota,
  kec: p.kec,
  kodepos: p.kodepos ?? "",
  tgl: p.tgl,
  paket: !!p.paket,
  items: p.items.map((it) => ({ ...it })),
  ongkir: p.ongkir ? String(p.ongkir) : "",
  karantina: p.karantina ? String(p.karantina) : "",
  ops: p.ops ? String(p.ops) : "",
  transfer: p.transfer ? String(p.transfer) : "",
  codOngkir: !!p.codOngkir,
  kurir: p.kurir || KURIR_NAMES[0],
  layanan: p.layanan || layananFor(p.kurir || KURIR_NAMES[0])[0],
  berat: p.berat ? String(p.berat) : "",
});

export default function PesananBaruScreen() {
  const { state, setState } = useStore();
  const toast = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === "string" && params.id ? params.id : null;
  const lama = editId ? state.pesanan.find((p) => p.id === editId) : undefined;

  const [form, setForm] = useState<Form>(() => (lama ? formFromPesanan(lama) : emptyForm()));
  const [showPenerima, setShowPenerima] = useState(false);

  // Saat mengubah pesanan, stok pesanan tsb dikembalikan dulu agar sisa stok benar.
  const stokState: StoreState = useMemo(
    () => (editId ? { ...state, pesanan: state.pesanan.filter((p) => p.id !== editId) } : state),
    [state, editId]
  );
  const allJenis = useMemo(() => jenisList(state), [state]);

  const totalHppForm = form.items.reduce((a, it) => a + it.hpp * it.jml, 0);
  const transferN = Number(form.transfer) || 0;
  const ongkirN = Number(form.ongkir) || 0;
  const karN = Number(form.karantina) || 0;
  const opsN = Number(form.ops) || 0;
  const overStok = form.items.some((it) => it.jml > sisaStok(stokState, it.jenis));

  function patchForm(p: Partial<Form>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function addJenisToKeranjang(jenis: string) {
    if (form.items.find((i) => i.jenis === jenis)) return;
    patchForm({ items: [...form.items, { jenis, jml: 1, hpp: hppJenis(stokState, jenis), harga: 0 }] });
  }

  function removeItem(jenis: string) {
    patchForm({ items: form.items.filter((i) => i.jenis !== jenis) });
  }

  function updateItemJml(jenis: string, jml: number) {
    patchForm({ items: form.items.map((i) => (i.jenis === jenis ? { ...i, jml } : i)) });
  }

  function togglePaketJenis(jenis: string) {
    if (form.items.find((i) => i.jenis === jenis)) removeItem(jenis);
    else addJenisToKeranjang(jenis);
  }

  function pickAllJenis() {
    const avail = allJenis.filter((j) => sisaStok(stokState, j) > 0);
    const items = avail.map((j) => {
      const existing = form.items.find((i) => i.jenis === j);
      return existing ?? { jenis: j, jml: 1, hpp: hppJenis(stokState, j), harga: 0 };
    });
    patchForm({ items });
  }

  function pakaiPenerima(p: Pesanan) {
    patchForm({ nama: p.nama, wa: p.wa, alamat: p.alamat, kota: p.kota, kec: p.kec, kodepos: p.kodepos });
    setShowPenerima(false);
  }

  function simpan() {
    const nama = form.nama.trim();
    const alamat = form.alamat.trim();
    const kota = form.kota.trim();
    const kec = form.kec.trim();
    const wa = normalizeWA(form.wa);
    const okItems = form.items.filter((it) => it.jml > 0);
    if (!nama || !wa || !alamat || !kota || !kec || okItems.length === 0 || transferN <= 0) {
      toast.show("Lengkapi data bertanda * dan pesanan dulu");
      return;
    }
    const p: Pesanan = {
      id: lama ? lama.id : uid(),
      tgl: form.tgl,
      nama,
      wa,
      alamat,
      kota,
      kec,
      kodepos: form.kodepos.trim(),
      items: okItems,
      paket: form.paket && okItems.length > 1,
      transfer: transferN,
      ongkir: ongkirN,
      karantina: karN,
      ops: opsN,
      codOngkir: form.codOngkir,
      tipe: lama ? lama.tipe : "PICKUP",
      kurir: form.kurir,
      layanan: layananFor(form.kurir)[0] || form.layanan,
      berat: Number(form.berat) || 0,
      status: lama ? lama.status : "Dikirim",
    };
    if (lama) {
      setState((s) => ({ ...s, pesanan: s.pesanan.map((x) => (x.id === p.id ? p : x)) }));
      toast.show("Perubahan pesanan tersimpan");
    } else {
      setState((s) => ({ ...s, pesanan: [p, ...s.pesanan] }));
      toast.show(`${tagItems(okItems)} tercatat di barang keluar`);
    }
    router.back();
  }

  return (
    <Screen
      title={lama ? "Ubah pesanan" : "Pesanan baru"}
      subtitle={lama ? `${lama.nama} · ${formatTgl(lama.tgl)}` : "Isi data penerima dan tanaman yang dikirim"}
      onBack={() => router.back()}
      floatingNav={false}
    >
      <Card>
        <SectionTitle n={1} title="Info penerima" />
        <Button
          title={showPenerima ? "Tutup pilihan" : "Pilih penerima tersimpan"}
          kind="alt"
          icon="person-outline"
          onPress={() => setShowPenerima((v) => !v)}
          testID="pilih-penerima-btn"
        />
        {showPenerima && (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {state.pesanan.length === 0 ? (
              <Text style={styles.muted}>Belum ada penerima tersimpan</Text>
            ) : (
              state.pesanan.slice(0, 10).map((p) => (
                <Pressable key={p.id} style={styles.penerimaRow} onPress={() => pakaiPenerima(p)}>
                  <Text style={styles.penerimaName}>{p.nama}</Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {p.kota} · {p.kec}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}
        <View style={{ height: spacing.md }} />
        <Field label="Nama" required>
          <Input value={form.nama} onChangeText={(v) => patchForm({ nama: v })} testID="input-nama" />
        </Field>
        <Field label="No telepon" required>
          <Input
            prefix="+62"
            value={form.wa.replace(/^62/, "")}
            onChangeText={(v) => patchForm({ wa: v })}
            keyboardType="phone-pad"
            testID="input-wa"
          />
        </Field>
        <Field label="Alamat lengkap" required>
          <Input value={form.alamat} onChangeText={(v) => patchForm({ alamat: v })} multiline testID="input-alamat" />
        </Field>
        <Field label="Kota/Kabupaten" required>
          <Input value={form.kota} onChangeText={(v) => patchForm({ kota: v })} testID="input-kota" />
        </Field>
        <Field label="Kecamatan" required>
          <Input value={form.kec} onChangeText={(v) => patchForm({ kec: v })} testID="input-kec" />
        </Field>
        <Field label="Kode pos">
          <Input value={form.kodepos} onChangeText={(v) => patchForm({ kodepos: v })} keyboardType="number-pad" />
        </Field>

        <Divider />
        <SectionTitle n={2} title="Pesanan" />
        <Field label="Tanggal pembuatan">
          <Input value={formatTgl(form.tgl)} editable={false} />
        </Field>
        <Field label="Pilih jenis atau paket">
          <Picker
            value=""
            placeholder="Pilih jenis atau paket"
            options={
              [
                PAKET_KEY,
                ...allJenis.filter((j) => sisaStok(stokState, j) > 0 || form.items.some((i) => i.jenis === j)),
              ] as string[]
            }
            labelFor={(v) => (v === PAKET_KEY ? "Paket (pilih beberapa jenis)" : `${v} · sisa ${sisaStok(stokState, v)}`)}
            onChange={(v) => {
              if (v === PAKET_KEY) patchForm({ paket: !form.paket });
              else {
                addJenisToKeranjang(v);
                patchForm({ paket: false });
              }
            }}
            testID="picker-jenis"
          />
        </Field>

        {form.paket && (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.labelInline}>Mode Paket</Text>
              <Pressable onPress={pickAllJenis}>
                <Text style={styles.linkPrimary}>Pilih semua jenis</Text>
              </Pressable>
            </View>
            {allJenis.map((j) => {
              const sisa = sisaStok(stokState, j);
              const checked = !!form.items.find((i) => i.jenis === j);
              const disabled = sisa <= 0 && !checked;
              return (
                <Pressable
                  key={j}
                  style={[styles.checkRow, disabled && { opacity: 0.4 }]}
                  disabled={disabled}
                  onPress={() => togglePaketJenis(j)}
                >
                  <Ionicons name={checked ? "checkbox" : "square-outline"} size={20} color={colors.brandPrimary} />
                  <Text style={styles.checkLabel}>
                    {j} · sisa {sisa}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {form.items.length > 0 && (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {form.items.map((it) => {
              const sisa = sisaStok(stokState, it.jenis);
              const over = it.jml > sisa;
              return (
                <View key={it.jenis} style={[styles.itemRow, over && { borderColor: colors.accent }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.itemJenis}>{it.jenis}</Text>
                    <Pressable onPress={() => removeItem(it.jenis)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.accent} />
                    </Pressable>
                  </View>
                  <Text style={styles.muted}>
                    HPP {formatRp(it.hpp)} · sisa {sisa}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 6 }}>
                    <Text style={styles.labelInline}>Jumlah</Text>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={String(it.jml)}
                        keyboardType="number-pad"
                        onChangeText={(v) => updateItemJml(it.jenis, Math.max(0, parseInt(v || "0") || 0))}
                        testID={`item-jml-${it.jenis}`}
                      />
                    </View>
                  </View>
                  <Text style={styles.subtotal}>Subtotal HPP: {formatRp(it.hpp * it.jml)}</Text>
                  {over && <Text style={styles.warn}>Melebihi sisa stok</Text>}
                </View>
              );
            })}
          </View>
        )}

        <Divider />
        <SectionTitle n={3} title="Biaya & transfer" />
        <View style={styles.rowRead}>
          <Text style={styles.muted}>HPP global</Text>
          <Text style={styles.readVal}>{formatRp(totalHppForm)}</Text>
        </View>
        <Field label="Ongkir (dibayar pembeli)">
          <Input value={form.ongkir} onChangeText={(v) => patchForm({ ongkir: v })} keyboardType="number-pad" />
        </Field>
        <Field label="Biaya karantina (dibayar pembeli)">
          <Input value={form.karantina} onChangeText={(v) => patchForm({ karantina: v })} keyboardType="number-pad" />
        </Field>
        <Field label="Biaya operasional">
          <Input value={form.ops} onChangeText={(v) => patchForm({ ops: v })} keyboardType="number-pad" />
        </Field>
        <Field label="Total Customer Transfer" required>
          <Input
            value={form.transfer}
            onChangeText={(v) => patchForm({ transfer: v })}
            keyboardType="number-pad"
            testID="input-transfer"
          />
        </Field>

        <Divider />
        <SectionTitle n={4} title="Pengiriman" />
        <Field label="Ekspedisi">
          <Picker
            value={form.kurir}
            options={KURIR_NAMES}
            onChange={(v) => patchForm({ kurir: v, layanan: layananFor(v)[0] || "Reguler" })}
            testID="picker-kurir"
          />
        </Field>
        <Field label="Layanan">
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Chip
              label="Non COD"
              active={!form.codOngkir}
              onPress={() => patchForm({ codOngkir: false })}
              testID="layanan-noncod"
            />
            <Chip
              label="COD Ongkir"
              active={form.codOngkir}
              color="pink"
              onPress={() => patchForm({ codOngkir: true })}
              testID="layanan-cod"
            />
          </View>
        </Field>
        <Field label="Berat paket (kg)">
          <Input value={form.berat} onChangeText={(v) => patchForm({ berat: v })} keyboardType="decimal-pad" />
        </Field>

        <Divider />
        <SectionTitle title="Rekapan" />
        <Rekapan
          transfer={transferN}
          ongkir={ongkirN}
          karantina={karN}
          ops={opsN}
          hpp={totalHppForm}
          codOngkir={form.codOngkir}
        />
        {overStok && <Text style={styles.warn}>Beberapa item melebihi sisa stok</Text>}

        <View style={{ height: spacing.lg }} />
        <Button
          title={lama ? "Simpan perubahan" : "Simpan pesanan"}
          icon="save-outline"
          onPress={simpan}
          testID="simpan-pesanan"
        />
        <View style={{ height: spacing.sm }} />
        <Button title="Batal" kind="ghost" onPress={() => router.back()} testID="batal-pesanan" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base - 1 },
  itemRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 2,
    padding: spacing.md,
    backgroundColor: colors.brandTertiary,
  },
  itemJenis: { fontFamily: fonts.bold, fontSize: fontSize.lg - 1, color: colors.onSurface },
  subtotal: { fontFamily: fonts.medium, marginTop: 6, color: colors.onSurface, fontSize: fontSize.base },
  rowRead: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  readVal: { fontFamily: fonts.bold, color: colors.onSurface, fontSize: fontSize.base },
  labelInline: { fontFamily: fonts.semibold, fontSize: fontSize.base - 1, color: colors.onSurface },
  linkPrimary: { fontFamily: fonts.bold, color: colors.brandPrimary, fontSize: fontSize.base },
  warn: { fontFamily: fonts.semibold, color: colors.accent, marginTop: 6, fontSize: fontSize.base - 1 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  checkLabel: { fontFamily: fonts.medium, color: colors.onSurface, fontSize: fontSize.base },
  penerimaRow: {
    padding: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  penerimaName: { fontFamily: fonts.bold, color: colors.onSurface, fontSize: fontSize.base },
});
