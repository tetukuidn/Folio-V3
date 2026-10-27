import type { Pesanan, StoreState } from "../store/types";
import { hargaJenis, hitungRekap, pct } from "./calc";

export function resellerNama(state: StoreState, id?: string): string {
  if (!id) return "";
  return (state.resellers || []).find((r) => r.id === id)?.nama || "Reseller";
}

// Ringkasan sekumpulan pesanan (pakai hitungRekap yang sama dengan Dashboard)
export function statsOf(orders: Pesanan[]) {
  let omset = 0;
  let hpp = 0;
  let laba = 0;
  let transfer = 0;
  let pohon = 0;
  let ongkir = 0;
  let karantina = 0;
  let ops = 0;
  for (const p of orders) {
    const r = hitungRekap(p);
    omset += r.omset;
    hpp += r.totalHpp;
    laba += r.keuntungan;
    transfer += r.totalTransfer;
    ongkir += r.og;
    karantina += p.karantina || 0;
    ops += p.ops || 0;
    pohon += p.items.reduce((a, i) => a + i.jml, 0);
  }
  return { omset, hpp, laba, transfer, pohon, ongkir, karantina, ops, jml: orders.length, margin: pct(laba, omset) };
}

// Margin % per jenis, memakai harga jual di Stok barang (harga terbaru):
// - Reseller dapat = (harga jual − harga reseller) / harga jual
// - Utama          = (harga jual − HPP) / harga jual
export function marginPerJenis(state: StoreState, resellerOrders: Pesanan[], mainOrders: Pesanan[]) {
  const r: Record<string, { jual: number; beli: number }> = {};
  const m: Record<string, { jual: number; hpp: number }> = {};
  for (const p of resellerOrders)
    for (const it of p.items) {
      const jual = hargaJenis(state, it.jenis).jual || it.hargaNormal || 0;
      if (jual <= 0) continue; // harga jual belum diatur: tidak dihitung
      const x = (r[it.jenis] ||= { jual: 0, beli: 0 });
      x.jual += jual * it.jml;
      x.beli += (it.harga || 0) * it.jml;
    }
  for (const p of mainOrders)
    for (const it of p.items) {
      const jual = hargaJenis(state, it.jenis).jual;
      if (jual <= 0) continue; // harga jual belum diatur: tidak dihitung
      const x = (m[it.jenis] ||= { jual: 0, hpp: 0 });
      x.jual += jual * it.jml;
      x.hpp += it.hpp * it.jml;
    }
  const rs = Object.values(r).reduce((a, x) => ({ jual: a.jual + x.jual, beli: a.beli + x.beli }), { jual: 0, beli: 0 });
  const ms = Object.values(m).reduce((a, x) => ({ jual: a.jual + x.jual, hpp: a.hpp + x.hpp }), { jual: 0, hpp: 0 });
  const rows = Array.from(new Set([...Object.keys(r), ...Object.keys(m)]))
    .sort()
    .map((jenis) => ({
      jenis,
      reseller: r[jenis] ? pct(r[jenis].jual - r[jenis].beli, r[jenis].jual) : null,
      utama: m[jenis] ? pct(m[jenis].jual - m[jenis].hpp, m[jenis].jual) : null,
    }));
  return {
    rows,
    avgReseller: pct(rs.jual - rs.beli, rs.jual),
    avgUtama: pct(ms.jual - ms.hpp, ms.jual),
    totalJualReseller: rs.jual,
    hasReseller: rs.jual > 0,
    hasUtama: ms.jual > 0,
  };
}

// Total nilai harga jual (Stok barang) dari barang di pesanan
export function nilaiJual(state: StoreState, orders: Pesanan[]): number {
  return orders.reduce((a, p) => a + p.items.reduce((x, it) => x + (hargaJenis(state, it.jenis).jual || it.hargaNormal || 0) * it.jml, 0), 0);
}

// Sheet terpisah untuk ekspor/backup data reseller
export function resellerSheets(state: StoreState): { name: string; aoa: (string | number)[][] }[] {
  const nama = (id?: string) => resellerNama(state, id);
  return [
    {
      name: "Reseller",
      aoa: [["Nama", "No HP", "Catatan", "Status"], ...(state.resellers || []).map((r) => [r.nama, r.hp, r.cat, r.aktif === false ? "Nonaktif" : "Aktif"])],
    },
    {
      name: "Penjualan Reseller",
      aoa: [
        ["Tanggal", "Reseller", "Jenis", "Jumlah", "HPP", "Harga reseller", "Harga normal", "Margin %", "Transfer pesanan"],
        ...(state.pesananReseller || []).flatMap((p) =>
          p.items.map((it) => [
            p.tgl.slice(0, 10),
            p.resellerNama || nama(p.resellerId),
            it.jenis,
            it.jml,
            it.hpp,
            it.harga || 0,
            it.hargaNormal || 0,
            Math.round(pct((it.harga || 0) - it.hpp, it.harga || 0) * 10) / 10,
            p.transfer,
          ])
        ),
      ],
    },
    {
      name: "Retur Reseller",
      aoa: [["Tanggal", "Reseller", "Jenis", "Jumlah", "HPP", "Keterangan"], ...(state.returReseller || []).map((r) => [r.tgl.slice(0, 10), nama(r.resellerId), r.jenis, r.jml, r.hpp, r.ket])],
    },
    {
      name: "Rusak Reseller",
      aoa: [
        ["Tanggal", "Reseller", "Jenis", "Jumlah", "HPP", "Keterangan"],
        ...(state.rusak || []).filter((r) => r.resellerId).map((r) => [r.tgl.slice(0, 10), nama(r.resellerId), r.jenis, r.jml, r.harga, r.ket]),
      ],
    },
  ];
}
