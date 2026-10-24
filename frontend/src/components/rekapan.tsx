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
}: {
  transfer: number;
  ongkir: number;
  karantina: number;
  ops: number;
  hpp: number;
  codOngkir: boolean;
}) {
  const og = codOngkir ? 0 : ongkir;
  const hargaJual = transfer - karantina - og;
  const keuntungan = hargaJual - hpp - ops;
  const kiri = transfer - og - karantina - ops;
  const kanan = hpp + keuntungan;
  const sesuai = Math.round(kiri) === Math.round(kanan);
  return (
    <View>
      <RRow label="Total Customer Transfer" val={transfer} />
      <RRow label="− Ongkir" val={-og} />
      <RRow label="− Biaya karantina" val={-karantina} />
      <RRow label="= Harga jual" val={hargaJual} bold />
      <RRow label="− Total HPP" val={-hpp} />
      <RRow label="− Biaya operasional" val={-ops} />
      <RRow label="= Keuntungan" val={keuntungan} bold danger={keuntungan < 0} />
      <Text style={styles.muted}>Cek: Transfer − ongkir − karantina − operasional = HPP + Keuntungan</Text>
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
