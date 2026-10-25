import type { Belanja, Pesanan, PesananItem, StoreState } from "../store/types";

// Jenis-level stok: masuk (sum belanja), keluar (sum items)
export function stokMasuk(state: StoreState, jenis: string): number {
  return state.belanja.filter((b) => b.jenis === jenis).reduce((a, b) => a + b.jml, 0);
}

// Keluar = terjual utama + terjual reseller
export function stokKeluar(state: StoreState, jenis: string): number {
  let n = 0;
  for (const p of state.pesanan) {
    for (const it of p.items) if (it.jenis === jenis) n += it.jml;
  }
  for (const p of state.pesananReseller || []) {
    for (const it of p.items) if (it.jenis === jenis) n += it.jml;
  }
  return n;
}

export function stokRetur(state: StoreState, jenis: string): number {
  return (state.returReseller || []).filter((r) => r.jenis === jenis).reduce((a, r) => a + r.jml, 0);
}

export function stokRusak(state: StoreState, jenis: string): number {
  return (state.rusak || []).filter((r) => r.jenis === jenis).reduce((a, r) => a + r.jml, 0);
}

// Sisa = Masuk + Retur − Terjual utama − Terjual reseller − Rusak
export function sisaStok(state: StoreState, jenis: string): number {
  return stokMasuk(state, jenis) + stokRetur(state, jenis) - stokKeluar(state, jenis) - stokRusak(state, jenis);
}

// Harga jual terbaru per jenis + harga reseller (fallback ke harga jual biasa)
export function hargaJenis(state: StoreState, jenis: string): { jual: number; reseller: number } {
  const rows = state.belanja
    .filter((b) => b.jenis === jenis)
    .sort((a, b) => new Date(b.tgl).getTime() - new Date(a.tgl).getTime());
  const jual = rows.find((b) => b.jual > 0)?.jual || 0;
  const reseller = rows.find((b) => (b.hargaReseller || 0) > 0)?.hargaReseller || jual;
  return { jual, reseller };
}

// Persen aman (0 jika penyebut 0)
export function pct(num: number, den: number): number {
  return den > 0 ? (num / den) * 100 : 0;
}

// HPP rata-rata per pohon untuk q pohon yang diambil dari baris tersisa paling lama (FIFO)
export function hppKeluarFIFO(state: StoreState, jenis: string, q: number): number {
  const fifo = stokFIFO(state);
  const rows = state.belanja
    .filter((b) => b.jenis === jenis)
    .sort((a, b) => new Date(a.tgl).getTime() - new Date(b.tgl).getTime() || a.id.localeCompare(b.id));
  let need = q;
  let val = 0;
  let took = 0;
  for (const b of rows) {
    if (need <= 0) break;
    const t = Math.min(fifo[b.id] ?? 0, need);
    val += t * b.harga;
    took += t;
    need -= t;
  }
  return took > 0 ? Math.round(val / took) : hppJenis(state, jenis);
}

// HPP rata-rata tertimbang untuk suatu jenis
export function hppJenis(state: StoreState, jenis: string): number {
  let sumQty = 0;
  let sumVal = 0;
  for (const b of state.belanja) {
    if (b.jenis === jenis) {
      sumQty += b.jml;
      sumVal += b.jml * b.harga;
    }
  }
  if (sumQty === 0) return 0;
  return Math.round(sumVal / sumQty);
}

// Daftar jenis unik
export function jenisList(state: StoreState): string[] {
  const set = new Set<string>();
  state.belanja.forEach((b) => set.add(b.jenis));
  return Array.from(set);
}

// FIFO: untuk kolom "Stok sekarang" per baris belanja.
// Pesanan keluar dikurangkan dari baris terlama (urut tgl, lalu id) per jenis.
export function stokFIFO(state: StoreState): Record<string, number> {
  const out: Record<string, number> = {};
  // init sisa = jml per baris
  for (const b of state.belanja) out[b.id] = b.jml;

  // kumpulkan keluar per jenis
  const keluarPerJenis: Record<string, number> = {};
  for (const p of state.pesanan) {
    for (const it of p.items) {
      keluarPerJenis[it.jenis] = (keluarPerJenis[it.jenis] ?? 0) + it.jml;
    }
  }
  for (const r of state.rusak || []) {
    keluarPerJenis[r.jenis] = (keluarPerJenis[r.jenis] ?? 0) + r.jml;
  }
  for (const p of state.pesananReseller || []) {
    for (const it of p.items) keluarPerJenis[it.jenis] = (keluarPerJenis[it.jenis] ?? 0) + it.jml;
  }
  // Retur reseller mengembalikan stok (mengurangi total keluar bersih)
  for (const r of state.returReseller || []) {
    keluarPerJenis[r.jenis] = (keluarPerJenis[r.jenis] ?? 0) - r.jml;
  }

  // group belanja by jenis sorted by tgl, id
  const byJenis: Record<string, Belanja[]> = {};
  for (const b of state.belanja) {
    (byJenis[b.jenis] ||= []).push(b);
  }
  for (const jenis of Object.keys(byJenis)) {
    byJenis[jenis].sort((a, b) => {
      const ta = new Date(a.tgl).getTime();
      const tb = new Date(b.tgl).getTime();
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
    let sisa = keluarPerJenis[jenis] ?? 0;
    for (const b of byJenis[jenis]) {
      if (sisa <= 0) break;
      const take = Math.min(out[b.id], sisa);
      out[b.id] -= take;
      sisa -= take;
    }
  }
  return out;
}

// Hitungan per pesanan
export type Rekap = {
  og: number;
  omset: number; // harga jual
  totalHpp: number;
  keuntungan: number;
  totalTransfer: number;
};

export function hitungRekap(p: Pesanan): Rekap {
  const og = p.codOngkir ? 0 : p.ongkir || 0;
  const omset = (p.transfer || 0) - (p.karantina || 0) - og;
  const totalHpp = p.items.reduce((a, it) => a + (it.hpp || 0) * (it.jml || 0), 0);
  const keuntungan = omset - totalHpp - (p.ops || 0);
  return { og, omset, totalHpp, keuntungan, totalTransfer: p.transfer || 0 };
}

export function totalItemJml(items: PesananItem[]): number {
  return items.reduce((a, b) => a + (b.jml || 0), 0);
}

export function tagItems(items: PesananItem[]): string {
  return items.map((it) => `${it.jenis} x${it.jml}`).join(", ");
}
