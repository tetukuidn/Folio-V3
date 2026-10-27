import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "@/src/components/screen";
import { Button, Card, Chip, Divider, Field, Input, Picker, SectionTitle } from "@/src/components/ui";
import { Rekapan } from "@/src/components/rekapan";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import type { Pesanan, PesananItem, PesananReseller, StoreState } from "@/src/store/types";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatRp, formatTgl, todayISO, uid } from "@/src/utils/format";
import { hargaJenis, hppJenis, jenisList, pct, sisaStok, tagItems } from "@/src/utils/calc";
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
  const params = useLocalSearchParams<{ id?: string; src?: string }>();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/dashboard"));
  const editId = typeof params.id === "string" && params.id ? params.id : null;
  const editReseller = params.src === "reseller";
  const lama: Pesanan | undefined = editId
    ? editReseller
      ? (state.pesananReseller || []).find((p) => p.id === editId)
      : state.pesanan.find((p) => p.id === editId)
    : undefined;
  const lamaRes = editReseller ? (lama as PesananReseller | undefined) : undefined;

  const [form, setForm] = useState<Form>(() => (lama ? formFromPesanan(lama) : emptyForm()));
  const [showPenerima, setShowPenerima] = useState(false);
  const [resellerOn, setResellerOn] = useState(editReseller);
  const [resellerId, setResellerId] = useState<string>(lamaRes?.resellerId || "");
  const [rSearch, setRSearch] = useState("");
  const [resErr, setResErr] = useState(false);
  const [confirmBelow, setConfirmBelow] = useState(false);

  // Saat mengubah pesanan, stok pesanan tsb dikembalikan dulu agar sisa stok benar.
  const stokState: StoreState = useMemo(() => {
    if (!editId) return state;
    if (editReseller) return { ...state, pesananReseller: (state.pesananReseller || []).filter((p) => p.id !== editId) };
    return { ...state, pesanan: state.pesanan.filter((p) => p.id !== editId) };
  }, [state, editId, editReseller]);
  const allJenis = useMemo(() => jenisList(state), [state]);
  const activeResellers = (state.resellers || []).filter((r) => r.aktif !== false || r.id === resellerId);
  const reseller = (state.resellers || []).find((r) => r.id === resellerId);
  const rOptions = activeResellers.filter((r) => !rSearch.trim() || r.nama.toLowerCase().includes(rSearch.trim().toLowerCase()));

  // Item baru: mode reseller isi harga reseller (fallback harga jual) + snapshot harga normal
  function newItem(jenis: string, on = resellerOn): PesananItem {
    const base = { jenis, jml: 1, hpp: hppJenis(stokState, jenis), harga: 0 };
    if (!on) return base;
    const h = hargaJenis(state, jenis);
    return { ...base, harga: h.reseller, hargaNormal: h.jual };
  }

  function setResellerMode(on: boolean) {
    setResellerOn(on);
    setResErr(false);
    setConfirmBelow(false);
    patchForm({
      items: form.items.map((it) => {
        if (!on) return { jenis: it.jenis, jml: it.jml, hpp: it.hpp, harga: 0 };
        const h = hargaJenis(state, it.jenis);
        return { ...it, harga: h.reseller, hargaNormal: h.jual };
      }),
    });
  }

  function updateItemHarga(jenis: string, harga: number) {
    setConfirmBelow(false);
    patchForm({ items: form.items.map((i) => (i.jenis === jenis ? { ...i, harga } : i)) });
  }

  const totalJualReseller = form.items.reduce((a, it) => a + (it.harga || 0) * it.jml, 0);
  const marginPesanan = pct(totalJualReseller - form.items.reduce((a, it) => a + it.hpp * it.jml, 0), totalJualReseller);
  const belowHpp = resellerOn && form.items.some((it) => it.jml > 0 && (it.harga || 0) < it.hpp);

  const totalHppForm = form.items.reduce((a, it) => a + it.hpp * it.jml, 0);
  // Harga reseller di Rekapan = harga jual dari Stok barang × jumlah
  const totalJualStokForm = form.items.reduce((a, it) => a + hargaJenis(stokState, it.jenis).jual * it.jml, 0);
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
    patchForm({ items: [...form.items, newItem(jenis)] });
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
      return existing ?? newItem(j);
    });
    patchForm({ items });
  }

  function pakaiPenerima(p: Pesanan) {
    patchForm({ nama: p.nama, wa: p.wa, alamat: p.alamat, kota: p.kota, kec: p.kec, kodepos: p.kodepos });
    setShowPenerima(false);
  }

  function simpan() {
    const okItems = form.items.filter((it) => it.jml > 0);
    if (overStok) {
      toast.show("Stok tidak cukup — kurangi jumlah item yang melebihi sisa");
      return;
    }
    if (resellerOn) {
      if (!reseller) {
        setResErr(true);
        toast.show("Pilih reseller dulu");
        return;
      }
      if (okItems.length === 0 || transferN <= 0) {
        toast.show("Isi item pesanan dan total transfer dulu");
        return;
      }
      if (belowHpp && !confirmBelow) {
        setConfirmBelow(true);
        toast.show("Ada harga di bawah HPP — tekan Simpan lagi untuk konfirmasi");
        return;
      }
      // Edit: jumlah per jenis tidak boleh di bawah yang sudah diretur reseller ini
      if (lama) {
        for (const r of Array.from(new Set((state.returReseller || []).filter((x) => x.resellerId === reseller.id).map((x) => x.jenis)))) {
          const returned = (state.returReseller || []).filter((x) => x.resellerId === reseller.id && x.jenis === r).reduce((a, x) => a + x.jml, 0);
          const soldOther = (stokState.pesananReseller || [])
            .filter((p) => p.resellerId === reseller.id)
            .reduce((a, p) => a + p.items.filter((i) => i.jenis === r).reduce((x, i) => x + i.jml, 0), 0);
          const soldHere = okItems.filter((i) => i.jenis === r).reduce((a, i) => a + i.jml, 0);
          if (soldOther + soldHere < returned) {
            toast.show(`${r}: sudah diretur ${returned} pohon, jumlah terjual tidak boleh kurang dari itu`);
            return;
          }
        }
      }
      const p: PesananReseller = {
        id: lama ? lama.id : uid(),
        tgl: form.tgl,
        nama: form.nama.trim() || reseller.nama,
        wa: normalizeWA(form.wa) || reseller.hp,
        alamat: form.alamat.trim(),
        kota: form.kota.trim(),
        kec: form.kec.trim(),
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
        resellerId: reseller.id,
        resellerNama: reseller.nama,
      };
      if (lama) {
        setState((s) => ({ ...s, pesananReseller: (s.pesananReseller || []).map((x) => (x.id === p.id ? p : x)) }));
        toast.show("Perubahan pesanan reseller tersimpan");
      } else {
        setState((s) => ({ ...s, pesananReseller: [p, ...(s.pesananReseller || [])] }));
        toast.show(`Pesanan reseller ${reseller.nama} tersimpan`);
      }
      goBack();
      return;
    }
    const nama = form.nama.trim();
    const alamat = form.alamat.trim();
    const kota = form.kota.trim();
    const kec = form.kec.trim();
    const wa = normalizeWA(form.wa);
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
    goBack();
  }

  return (
    <Screen
      title={lama ? "Ubah pesanan" : "Pesanan baru"}
      subtitle={lama ? `${lama.nama} · ${formatTgl(lama.tgl)}` : "Isi data penerima dan tanaman yang dikirim"}
      onBack={goBack}
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
                  {resellerOn && (
                    <View style={{ marginTop: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <Text style={styles.labelInline}>Harga reseller</Text>
                        <View style={{ flex: 1 }}>
                          <Input
                            prefix="Rp"
                            value={it.harga ? String(it.harga) : ""}
                            keyboardType="number-pad"
                            onChangeText={(v) => updateItemHarga(it.jenis, Math.max(0, parseInt(v || "0") || 0))}
                            testID={`item-harga-${it.jenis}`}
                          />
                        </View>
                      </View>
                      <Text style={[styles.muted, (it.harga || 0) < it.hpp && { color: colors.accent }]} testID={`item-margin-${it.jenis}`}>
                        Margin {pct((it.harga || 0) - it.hpp, it.harga || 0).toFixed(0)}%
                        {it.hargaNormal
                          ? ` · ${it.hargaNormal >= (it.harga || 0) ? "lebih murah" : "lebih mahal"} ${Math.abs(
                              pct(it.hargaNormal - (it.harga || 0), it.hargaNormal)
                            ).toFixed(0)}% dari harga normal`
                          : " · harga normal belum diatur"}
                      </Text>
                      {(it.harga || 0) < it.hpp && <Text style={styles.warn}>Harga di bawah HPP</Text>}
                    </View>
                  )}
                  {over && <Text style={styles.warn}>Melebihi sisa stok</Text>}
                </View>
              );
            })}
          </View>
        )}

        <Divider />
        <SectionTitle n={3} title="Biaya & transfer" />
        <View style={styles.rowRead}>
          <Text style={styles.muted}>Harga Reseller</Text>
          <Text style={styles.readVal}>{formatRp(totalJualStokForm)}</Text>
        </View>
        <Field label="Ongkir (dibayar pembeli)">
          <Input value={form.ongkir} onChangeText={(v) => patchForm({ ongkir: v })} keyboardType="number-pad" testID="input-ongkir" />
        </Field>
        <Field label="Biaya karantina (dibayar pembeli)">
          <Input value={form.karantina} onChangeText={(v) => patchForm({ karantina: v })} keyboardType="number-pad" testID="input-karantina" />
        </Field>
        <Field label="Biaya operasional">
          <Input value={form.ops} onChangeText={(v) => patchForm({ ops: v })} keyboardType="number-pad" testID="input-ops" />
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
        <Pressable
          style={styles.toggleRow}
          onPress={() => !editId && setResellerMode(!resellerOn)}
          disabled={!!editId}
          testID="toggle-reseller-row"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.labelInline}>Reseller</Text>
            <Text style={styles.muted}>{editId ? "Jenis pesanan tidak bisa diganti saat mengubah" : "Catat sebagai penjualan ke reseller"}</Text>
          </View>
          <Switch
            value={resellerOn}
            onValueChange={setResellerMode}
            disabled={!!editId}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            testID="toggle-reseller"
          />
        </Pressable>
        {resellerOn && (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }} testID="reseller-picker">
            {reseller ? (
              <View style={[styles.penerimaRow, { borderColor: colors.brandPrimary }]} testID="reseller-terpilih">
                <Text style={styles.penerimaName}>{reseller.nama}</Text>
                {!editId && (
                  <Pressable onPress={() => setResellerId("")} hitSlop={8} testID="reseller-ganti">
                    <Text style={styles.linkPrimary}>Ganti reseller</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <Input value={rSearch} onChangeText={setRSearch} placeholder="Cari nama reseller..." testID="reseller-search" />
                {activeResellers.length === 0 ? (
                  <Pressable onPress={() => router.push("/reseller")} testID="reseller-kosong">
                    <Text style={styles.linkPrimary}>Belum ada reseller aktif — tambah di menu Reseller</Text>
                  </Pressable>
                ) : (
                  rOptions.slice(0, 8).map((r) => (
                    <Pressable
                      key={r.id}
                      style={styles.penerimaRow}
                      onPress={() => {
                        setResellerId(r.id);
                        setResErr(false);
                      }}
                      testID={`reseller-opt-${r.id}`}
                    >
                      <Text style={styles.penerimaName}>{r.nama}</Text>
                      {r.hp ? <Text style={styles.muted}>+{r.hp}</Text> : null}
                    </Pressable>
                  ))
                )}
                {resErr && <Text style={styles.warn} testID="reseller-error">Reseller wajib dipilih sebelum menyimpan</Text>}
              </>
            )}
          </View>
        )}

        <Divider />
        <SectionTitle title="Rekapan" />
        <Rekapan
          transfer={transferN}
          ongkir={ongkirN}
          karantina={karN}
          ops={opsN}
          hpp={totalHppForm}
          codOngkir={form.codOngkir}
          hargaJualStok={totalJualStokForm}
          jualLabel="Harga reseller"
          hideHargaJual
        />
        {resellerOn && (
          <View style={{ marginTop: spacing.sm }} testID="rekap-reseller">
            <View style={styles.rowRead}>
              <Text style={styles.muted}>Total harga reseller</Text>
              <Text style={styles.readVal}>{formatRp(totalJualReseller)}</Text>
            </View>
            {totalJualReseller > 0 && transferN !== totalJualReseller + (form.codOngkir ? 0 : ongkirN) + karN && (
              <Pressable
                onPress={() => patchForm({ transfer: String(totalJualReseller + (form.codOngkir ? 0 : ongkirN) + karN) })}
                style={{ minHeight: 40, justifyContent: "center" }}
                testID="pakai-harga-reseller"
              >
                <Text style={styles.linkPrimary}>Isi total transfer dari harga reseller (+ ongkir & karantina)</Text>
              </Pressable>
            )}
            <View style={styles.rowRead}>
              <Text style={styles.muted}>Total margin pesanan</Text>
              <Text style={[styles.readVal, marginPesanan < 0 && { color: colors.accent }]} testID="rekap-margin-total">
                {marginPesanan.toFixed(1)}%
              </Text>
            </View>
            {belowHpp && (
              <Text style={styles.warn} testID="warn-below-hpp">
                {confirmBelow ? "Harga di bawah HPP. Tekan Simpan sekali lagi untuk tetap menyimpan." : "Ada item dengan harga di bawah HPP."}
              </Text>
            )}
          </View>
        )}
        {overStok && <Text style={styles.warn}>Beberapa item melebihi sisa stok</Text>}

        <View style={{ height: spacing.lg }} />
        <Button
          title={lama ? "Simpan perubahan" : confirmBelow && belowHpp ? "Tetap simpan" : "Simpan pesanan"}
          icon="save-outline"
          onPress={simpan}
          testID="simpan-pesanan"
        />
        <View style={{ height: spacing.sm }} />
        <Button title="Batal" kind="ghost" onPress={goBack} testID="batal-pesanan" />
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
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48 },
});
