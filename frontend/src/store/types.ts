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
};

export type Supplier = { id: string; nama: string; hp: string; cat: string };

export type PesananItem = { jenis: string; jml: number; hpp: number; harga: number };

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

export type Sender = {
  nama: string;
  alamat: string;
  telp: string;
  kec: string;
  kota: string;
};

export type StoreState = {
  belanja: Belanja[];
  suppliers: Supplier[];
  pesanan: Pesanan[];
  sender: Sender;
};

export function emptyState(): StoreState {
  return {
    belanja: [],
    suppliers: [],
    pesanan: [],
    sender: { nama: "", alamat: "", telp: "", kec: "", kota: "" },
  };
}

export function emptyProfil(): Profil {
  return { namaPemilik: "", namaToko: "", waToko: "" };
}
