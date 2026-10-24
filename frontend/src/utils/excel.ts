import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { ymd } from "./format";
import type { Pesanan, Sender } from "../store/types";
import { normalizeWA } from "./phone";

export const HEADERS = [
  "No",
  "Jenis Pengiriman*",
  "Pilihan Kurir*",
  "Jenis Layanan*",
  "Nama Pengirim*",
  "Alamat Pengirim*",
  "No Telp. Pengirim*",
  "Kecamatan Pengirim*",
  "Kota Pengirim*",
  "Nama Penerima*",
  "Alamat Penerima*",
  "No Telp. Penerima*",
  "Kecamatan Penerima*",
  "Kota Penerima*",
  "Berat (kg)*",
  "Panjang (cm)",
  "Lebar (cm)",
  "Tinggi (cm)",
  "Isi Paket*",
  "Kategori Produk (opt)",
  "Asuransi (Jika ya)",
  "Harga Barang (jika non-COD)",
  "Nilai COD (Jika COD)",
  "Instruksi Pengiriman (opt)",
  "No Referensi (opt)",
];

export const REQUIRED_IDX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18];

export function rowFor(p: Pesanan, sender: Sender, no: number): (string | number)[] {
  const cod = p.codOngkir || (p.tipe || "").startsWith("COD");
  let jenisPengiriman: string = p.tipe;
  if (p.codOngkir && !jenisPengiriman.startsWith("COD")) jenisPengiriman = "COD " + jenisPengiriman;
  if (jenisPengiriman === "DROPOFF" && p.kurir === "J&T Express") jenisPengiriman = "PICKUP";
  if (jenisPengiriman === "COD DROPOFF" && p.kurir === "J&T Express") jenisPengiriman = "COD PICKUP";

  const isi = p.items.map((it) => `Aglonema ${it.jenis} x ${it.jml}`).join(", ");
  const omset = (p.transfer || 0) - (p.karantina || 0) - (p.codOngkir ? 0 : p.ongkir || 0);
  const nilaiCod = cod ? (p.codOngkir ? p.ongkir : p.transfer) : "";
  const hargaBarang = cod ? "" : omset;

  return [
    no,
    jenisPengiriman,
    p.kurir || "",
    p.layanan || "",
    sender.nama || "",
    sender.alamat || "",
    sender.telp ? Number(normalizeWA(sender.telp)) : "",
    sender.kec || "",
    sender.kota || "",
    p.nama || "",
    p.alamat || "",
    p.wa ? Number(normalizeWA(p.wa)) : "",
    p.kec || "",
    p.kota || "",
    p.berat || "",
    "",
    "",
    "",
    isi,
    "Bibit Tanaman Hidup (Tanpa Surat Karantina)",
    "",
    hargaBarang,
    nilaiCod,
    "",
    "ORD-" + p.id.slice(-5),
  ];
}

export function missingRequired(row: (string | number)[]): number {
  let n = 0;
  for (const i of REQUIRED_IDX) {
    const v = row[i];
    if (v === "" || v === undefined || v === null) n++;
  }
  return n;
}

export async function exportExcel(rows: (string | number)[][]): Promise<string> {
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Upload");
  const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  const name = `Upload_Order_Everpro_${ymd(new Date())}.xlsx`;
  const uri = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + name;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Simpan file Excel",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    });
  }
  return uri;
}

export function toTSV(rows: (string | number)[][]): string {
  const all = [HEADERS, ...rows];
  return all.map((r) => r.map((c) => String(c ?? "")).join("\t")).join("\n");
}
