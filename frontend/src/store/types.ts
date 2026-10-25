export type Profil = {
  namaPemilik: string;
  namaToko: string;
  waToko: string;
};

export type Belanja = {
  id: string;
  tgl: string;
  jenis: string;
  sup: string; // supplier id or ""
  jml: number;
  awal: number;
  harga: number; // HPP beli
  jual: number; // harga jual
  hargaReseller?: number; // harga jual khusus reseller (opsional)
};

export type Reseller = { id: string; nama: string; hp: string; cat: string; aktif?: boolean };

// Barang kembali dari reseller (stok bertambah)
export type ReturReseller = {
  id: string;
  tgl: string;
  resellerId: string;
  jenis: string;
  jml: number;
  hpp: number;
  ket: string;
};

// Stok keluar karena rusak/mati (mengurangi persediaan, bukan penjualan)
export type Rusak = {
  id: string;
  tgl: string;
  jenis: string;
  jml: number;
  harga: number; // HPP per pohon (FIFO saat dicatat)
  ket: string;
  resellerId?: string;
};

export type Supplier = { id: string; nama: string; hp: string; cat: string };

export type PesananItem = { jenis: string; jml: number; hpp: number; harga: number; hargaNormal?: number };

export type Tipe = "PICKUP" | "DROPOFF" | "COD PICKUP" | "COD DROPOFF";
export type StatusPesanan = "Dikirim" | "Problem";

export type Pesanan = {
  id: string;
  tgl: string;
  nama: string;
  wa: string;
  alamat: string;
  kota: string;
  kec: string;
  kodepos: string;
  items: PesananItem[];
  paket: boolean;
  transfer: number;
  ongkir: number;
  karantina: number;
  ops: number;
  codOngkir: boolean;
  tipe: Tipe;
  kurir: string;
  layanan: string;
  berat: number;
  status: StatusPesanan;
};

export type PesananReseller = Pesanan & { resellerId: string; resellerNama: string };

export type Sender = {
  nama: string;
  alamat: string;
  telp: string;
  kec: string;
  kota: string;
};

export type StoreState = {
  belanja: Belanja[];
  rusak: Rusak[];
  suppliers: Supplier[];
  pesanan: Pesanan[];
  sender: Sender;
  resellers: Reseller[];
  pesananReseller: PesananReseller[];
  returReseller: ReturReseller[];
};

export function emptyState(): StoreState {
  return {
    belanja: [],
    rusak: [],
    suppliers: [],
    pesanan: [],
    sender: { nama: "", alamat: "", telp: "", kec: "", kota: "" },
    resellers: [],
    pesananReseller: [],
    returReseller: [],
  };
}

export function emptyProfil(): Profil {
  return { namaPemilik: "", namaToko: "", waToko: "" };
}
