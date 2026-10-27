import React, { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Screen } from "@/src/components/screen";
import { Button, Card, Chip, Input } from "@/src/components/ui";
import { Rekapan } from "@/src/components/rekapan";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import type { Pesanan, PesananItem, StatusPesanan } from "@/src/store/types";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { formatRp, formatTgl } from "@/src/utils/format";
import { hargaJenis, hitungRekap } from "@/src/utils/calc";
import { displayWA, normalizeWA } from "@/src/utils/phone";

export default function PesananScreen() {
  const { state, setState } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [openDetail, setOpenDetail] = useState<Record<string, boolean>>({});
  const [sumber, setSumber] = useState<"semua" | "utama" | "reseller">("semua");
  const resOrders = useMemo(() => state.pesananReseller || [], [state.pesananReseller]);

  function toggleStatusRes(id: string) {
    setState((s) => ({
      ...s,
      pesananReseller: (s.pesananReseller || []).map((p) =>
        p.id === id ? { ...p, status: (p.status === "Dikirim" ? "Problem" : "Dikirim") as StatusPesanan } : p
      ),
    }));
  }

  // Hapus pesanan reseller ditolak jika barangnya sudah diretur (sama seperti di menu Reseller)
  function hapusRes(id: string) {
    const p = resOrders.find((x) => x.id === id);
    if (!p) return;
    const returs = (state.returReseller || []).filter((r) => r.resellerId === p.resellerId);
    for (const it of p.items) {
      const returned = returs.filter((r) => r.jenis === it.jenis).reduce((a, r) => a + r.jml, 0);
      const sold = resOrders
        .filter((x) => x.resellerId === p.resellerId)
        .reduce((a, x) => a + x.items.filter((i) => i.jenis === it.jenis).reduce((n, i) => n + i.jml, 0), 0);
      if (returned > sold - it.jml) {
        toast.show(`Tidak bisa dihapus: ${it.jenis} sudah diretur. Hapus catatan returnya dulu.`);
        return;
      }
    }
    setState((s) => ({ ...s, pesananReseller: (s.pesananReseller || []).filter((x) => x.id !== id) }));
    toast.show("Pesanan reseller dihapus");
  }

  function toggleStatus(id: string) {
    setState((s) => ({
      ...s,
      pesanan: s.pesanan.map((p) =>
        p.id === id ? { ...p, status: (p.status === "Dikirim" ? "Problem" : "Dikirim") as StatusPesanan } : p
      ),
    }));
  }

  function hapus(id: string) {
    setState((s) => ({ ...s, pesanan: s.pesanan.filter((p) => p.id !== id) }));
    toast.show("Pesanan dihapus");
  }

  function chatWA(wa: string) {
    const n = normalizeWA(wa);
    if (n) Linking.openURL(`https://wa.me/${n}`);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all: { p: Pesanan; res?: string }[] = [
      ...(sumber === "reseller" ? [] : state.pesanan.map((p) => ({ p }))),
      ...(sumber === "utama" ? [] : resOrders.map((p) => ({ p: p as Pesanan, res: p.resellerNama || "Reseller" }))),
    ].sort((a, b) => new Date(b.p.tgl).getTime() - new Date(a.p.tgl).getTime());
    if (!q) return all;
    return all.filter(({ p, res }) =>
      [p.nama, p.kota, p.kec, p.kurir, p.status, formatTgl(p.tgl), p.items.map((i) => i.jenis).join(" "), res || "utama"]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [state.pesanan, resOrders, search, sumber]);

  const tabs = [
    { k: "semua" as const, l: `Semua (${state.pesanan.length + resOrders.length})` },
    { k: "utama" as const, l: `Utama (${state.pesanan.length})` },
    { k: "reseller" as const, l: `Reseller (${resOrders.length})` },
  ];

  return (
    <Screen title="Pesanan" subtitle={`${state.pesanan.length} utama · ${resOrders.length} reseller`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        {tabs.map((t) => {
          const active = sumber === t.k;
          return (
            <Pressable key={t.k} onPress={() => setSumber(t.k)} style={[styles.srcChip, active && styles.srcChipActive]} testID={`pesanan-sumber-${t.k}`}>
              <Text style={[styles.srcChipText, active && styles.srcChipTextActive]} numberOfLines={1}>{t.l}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Input
        placeholder="Cari nama, jenis, kota, ekspedisi…"
        value={search}
        onChangeText={setSearch}
        testID="search-pesanan"
      />

      {filtered.length === 0 && (
        <Card>
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={28} color={colors.brandPrimary} />
            </View>
            <Text style={styles.emptyTitle}>Belum ada pesanan</Text>
            <Text style={styles.muted}>Tekan tombol + di menu bawah untuk membuat pesanan baru</Text>
          </View>
        </Card>
      )}

      {filtered.map(({ p, res }) => (
        <PesananCard
          key={(res ? "r" : "u") + p.id}
          p={p}
          reseller={res}
          open={!!openDetail[(res ? "r" : "u") + p.id]}
          onToggleOpen={() => setOpenDetail((d) => ({ ...d, [(res ? "r" : "u") + p.id]: !d[(res ? "r" : "u") + p.id] }))}
          onToggleStatus={() => (res ? toggleStatusRes(p.id) : toggleStatus(p.id))}
          onEdit={() => router.push({ pathname: "/pesanan-baru", params: res ? { id: p.id, src: "reseller" } : { id: p.id } })}
          onDelete={() => (res ? hapusRes(p.id) : hapus(p.id))}
          onChat={() => chatWA(p.wa)}
          jualOf={(it) => hargaJenis(state, it.jenis).jual || it.hargaNormal || 0}
        />
      ))}
    </Screen>
  );
}

function PesananCard({
  p,
  reseller,
  open,
  onToggleOpen,
  onToggleStatus,
  onEdit,
  onDelete,
  onChat,
  jualOf,
}: {
  p: Pesanan;
  reseller?: string;
  jualOf: (it: PesananItem) => number;
  open: boolean;
  onToggleOpen: () => void;
  onToggleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChat: () => void;
}) {
  const rek = hitungRekap(p);
  const jualStok = p.items.reduce((a, it) => a + jualOf(it) * it.jml, 0);
  // Keuntungan = Transfer − ongkir − karantina − operasional − harga jual (Stok barang)
  const keuntungan = rek.totalTransfer - rek.og - (p.karantina || 0) - (p.ops || 0) - jualStok;
  return (
    <Card testID={`pesanan-card-${p.id}`} style={reseller ? styles.cardReseller : undefined}>
      <View style={[styles.srcBadge, reseller ? styles.srcBadgeRes : styles.srcBadgeUtama]} testID={`pesanan-badge-${p.id}`}>
        <Ionicons name={reseller ? "storefront-outline" : "home-outline"} size={12} color={reseller ? colors.onAccentMuted : colors.brandPrimary} />
        <Text style={[styles.srcBadgeText, reseller && { color: colors.onAccentMuted }]} numberOfLines={1}>
          {reseller ? `Reseller · ${reseller}` : "Utama"}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(p.nama || "?").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {p.nama}
          </Text>
          <Text style={styles.muted}>{formatTgl(p.tgl)}</Text>
        </View>
        <Chip label={p.status} color={p.status === "Dikirim" ? "green" : "pink"} onPress={onToggleStatus} testID={`status-chip-${p.id}`} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md }}>
        {p.items.map((it) => (
          <Chip key={it.jenis} label={`${it.jenis} x${it.jml}`} color="muted" />
        ))}
        {p.paket && <Chip label="Paket" color="pink" />}
      </View>

      <Text style={[styles.muted, { marginTop: spacing.sm }]}>
        {[p.kurir, p.layanan, `${p.berat || 0} kg`].filter(Boolean).join(" · ")}
      </Text>

      <View style={styles.moneyRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.muted}>Total transfer</Text>
          <Text style={styles.money} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatRp(rek.totalTransfer)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.muted}>Keuntungan</Text>
          <Text
            style={[styles.money, keuntungan < 0 && { color: colors.accent }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatRp(keuntungan)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button
            title={open ? "Tutup" : "Detail"}
            kind="alt"
            onPress={onToggleOpen}
            testID={`lihat-detail-${p.id}`}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Ubah" kind="out" icon="create-outline" onPress={onEdit} testID={`ubah-pesanan-${p.id}`} />
        </View>
        <Pressable onPress={onChat} style={styles.waBtn} testID={`chat-wa-${p.id}`}>
          <Ionicons name="logo-whatsapp" size={22} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {open && (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <DetailBlock title="Penerima">
            <DetailRow k="Nama" v={p.nama} />
            <DetailRow k="WA" v={displayWA(p.wa)} />
            <DetailRow k="Alamat" v={p.alamat} />
            <DetailRow k="Kota" v={p.kota} />
            <DetailRow k="Kec" v={p.kec} />
            {p.kodepos ? <DetailRow k="Kode pos" v={p.kodepos} /> : null}
          </DetailBlock>
          <DetailBlock title="Pesanan">
            {p.items.map((it) => (
              <DetailRow key={it.jenis} k={it.jenis} v={`${it.jml} pohon · Harga jual ${formatRp(jualOf(it))}`} />
            ))}
          </DetailBlock>
          <DetailBlock title="Pengiriman">
            <DetailRow k="Kurir" v={`${p.kurir} ${p.layanan}`} />
            <DetailRow k="Tipe" v={p.tipe} />
            <DetailRow k="Berat" v={`${p.berat} kg`} />
          </DetailBlock>
          <DetailBlock title="Rekapan">
            <Rekapan
              transfer={p.transfer}
              ongkir={p.ongkir}
              karantina={p.karantina}
              ops={p.ops}
              hpp={rek.totalHpp}
              codOngkir={p.codOngkir}
              hargaJualStok={jualStok}
            />
          </DetailBlock>
          <Pressable onPress={onDelete} style={{ alignSelf: "flex-start", marginTop: 4, minHeight: 44, justifyContent: "center" }}>
            <Text style={styles.linkDanger}>Hapus pesanan</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailTitle}>{title}</Text>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
      <Text style={styles.muted}>{k}</Text>
      <Text style={styles.detailVal} numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexGrow: 0, height: 56 },
  chipRowContent: { gap: spacing.sm, alignItems: "center" },
  srcChip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    justifyContent: "center",
    flexShrink: 0,
  },
  srcChipActive: { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep },
  srcChipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted },
  srcChipTextActive: { color: colors.onBrandPrimary },
  cardReseller: { borderLeftWidth: 4, borderLeftColor: colors.accent },
  srcBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
  srcBadgeUtama: { backgroundColor: colors.brandTertiary },
  srcBadgeRes: { backgroundColor: colors.accentMuted },
  srcBadgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brandPrimary },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.base - 1 },
  cardTitle: { fontFamily: fonts.display, fontSize: fontSize.xl - 2, color: colors.onSurface },
  money: { fontFamily: fonts.display, fontSize: fontSize.lg + 2, color: colors.onSurface, marginTop: 2 },
  moneyRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.brandPrimary },
  waBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  linkDanger: { fontFamily: fonts.bold, color: colors.accent, fontSize: fontSize.base },
  detailBlock: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md + 2,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailTitle: { fontFamily: fonts.bold, color: colors.onSurface, fontSize: fontSize.base },
  detailVal: {
    fontFamily: fonts.medium,
    color: colors.onSurface,
    flex: 1,
    textAlign: "right",
    marginLeft: 8,
    fontSize: fontSize.base - 1,
  },
  emptyWrap: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: fonts.display, fontSize: fontSize.xl - 2, color: colors.onSurface },
});
