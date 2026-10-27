import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, fontSize } from "../theme";
import { formatRp } from "../utils/format";

export function Rekapan({
  transfer,
  ongkir,
  karantina,
  ops,
  hpp,
  codOngkir,
  hargaJualStok,
  jualLabel = "Harga jual (Stok barang)",
  hideHargaJual,
  jualAtTop,
}: {
  transfer: number;
  ongkir: number;
  karantina: number;
  ops: number;
  hpp: number;
  codOngkir: boolean;
  // Jika diisi, baris "Total HPP" ditampilkan sebagai harga jual dari Stok barang (hitungan keuntungan tetap)
  hargaJualStok?: number;
  jualLabel?: string;
  hideHargaJual?: boolean;
  // Tampilkan baris harga jual Stok barang tepat di atas Ongkir
  jualAtTop?: boolean;
}) {
  const og = codOngkir ? 0 : ongkir;
  const hargaJual = transfer - karantina - og;
  // Dengan harga jual Stok barang: Keuntungan = Transfer − ongkir − karantina − operasional − harga jual
  const pengurang = hargaJualStok === undefined ? hpp : hargaJualStok;
  const keuntungan = hargaJual - pengurang - ops;
  const kiri = transfer - og - karantina - ops;
  const kanan = pengurang + keuntungan;
  const sesuai = Math.round(kiri) === Math.round(kanan);
  return (
    <View>
      <RRow label="Total Customer Transfer" val={transfer} />
      {jualAtTop && hargaJualStok !== undefined && <RRow label={`− ${jualLabel}`} val={-hargaJualStok} />}
      <RRow label="− Ongkir" val={-og} />
      <RRow label="− Biaya karantina" val={-karantina} />
      {!hideHargaJual && <RRow label="= Harga jual" val={hargaJual} bold />}
      {hargaJualStok === undefined ? (
        <RRow label="− Total HPP" val={-hpp} />
      ) : (
        !jualAtTop && <RRow label={`− ${jualLabel}`} val={-hargaJualStok} />
      )}
      <RRow label="− Biaya operasional" val={-ops} />
      <RRow label="= Keuntungan" val={keuntungan} bold danger={keuntungan < 0} />
      <Text style={styles.muted}>
        Cek: Transfer − ongkir − karantina − operasional = {hargaJualStok === undefined ? "HPP" : jualLabel.replace(" (Stok barang)", "")} + Keuntungan
      </Text>
      <Text style={[styles.flag, { color: sesuai ? colors.brandPrimary : colors.accent }]}>
        {sesuai ? "Sesuai" : "Tidak sesuai"}
      </Text>
      {codOngkir && <Text style={styles.muted}>Catatan: Ongkir dibayar ke kurir dan tidak ikut ditransfer.</Text>}
    </View>
  );
}

function RRow({ label, val, bold, danger }: { label: string; val: number; bold?: boolean; danger?: boolean }) {
  return (
    <View style={styles.row}>
      <Text
        style={[styles.label, { fontFamily: bold ? fonts.bold : fonts.body }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.val,
          { fontFamily: bold ? fonts.bold : fonts.medium },
          danger && { color: colors.accent },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {formatRp(val)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3, gap: 8 },
  label: { color: colors.onSurface, fontSize: fontSize.base, flexShrink: 1 },
  val: { color: colors.onSurface, fontSize: fontSize.base },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.sm, marginTop: 6 },
  flag: { fontFamily: fonts.bold, fontSize: fontSize.base },
});
