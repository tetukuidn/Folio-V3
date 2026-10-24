export type Kurir = { nama: string; layanan: string[] };

export const KURIR: Kurir[] = [
  { nama: "Lion Parcel", layanan: ["Reguler", "Cargo"] },
  { nama: "ID Express", layanan: ["Reguler"] },
  { nama: "J&T Express", layanan: ["Reguler"] },
  { nama: "J&T Cargo", layanan: ["Cargo"] },
  { nama: "POS Indonesia", layanan: ["Reguler", "Express"] },
];

export const KURIR_NAMES = KURIR.map((k) => k.nama);

export function layananFor(nama: string): string[] {
  return KURIR.find((k) => k.nama === nama)?.layanan ?? [];
}
