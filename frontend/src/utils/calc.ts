import type { Belanja, Pesanan, PesananItem, StoreState } from "../store/types";

// Jenis-level stok: masuk (sum belanja), keluar (sum items)
export function stokMasuk(state: StoreState, jenis: string): number {
  return state.belanja.filter((b) => b.jenis === jenis).reduce((a, b) => a + b.jml, 0);
}

export function stokKeluar(state: StoreState, jenis: string): number {
  let n = 0;
  for (const p of state.pesanan) {
    for (const it of p.items) if (it.jenis === jenis) n += it.jml;
  }
  return n;
}

export function sisaStok(state: StoreState, jenis: string): number {
  return stokMasuk(state, jenis) - stokKeluar(state, jenis);
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
