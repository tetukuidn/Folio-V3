import React, { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "@/src/components/screen";
import { Button, Card, Field, Input } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { useStore } from "@/src/store";
import type { Supplier } from "@/src/store/types";
import { colors, fonts, spacing } from "@/src/theme";
import { formatRp, uid } from "@/src/utils/format";
import { displayWA, normalizeWA } from "@/src/utils/phone";

export default function SupplierScreen() {
  const { state, setState } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [hp, setHp] = useState("");
  const [cat, setCat] = useState("");

  const perSup = useMemo(() => {
    const map: Record<string, { count: number; hpp: number }> = {};
    for (const b of state.belanja) {
      if (!b.sup) continue;
      const m = (map[b.sup] ||= { count: 0, hpp: 0 });
      m.count++;
      m.hpp += b.harga * b.jml;
    }
    return map;
  }, [state.belanja]);

  function tambah() {
    const n = nama.trim();
    if (!n) {
      toast.show("Nama supplier wajib diisi");
      return;
    }
    if (state.suppliers.some((s) => s.nama.toLowerCase() === n.toLowerCase())) {
      toast.show("Nama supplier sudah ada");
      return;
    }
    const s: Supplier = { id: uid(), nama: n, hp: normalizeWA(hp), cat };
    setState((st) => ({ ...st, suppliers: [s, ...st.suppliers] }));
    setNama("");
    setHp("");
    setCat("");
    toast.show("Supplier ditambahkan");
  }

  function hapus(id: string) {
    setState((st) => ({ ...st, suppliers: st.suppliers.filter((s) => s.id !== id) }));
    toast.show("Supplier dihapus");
  }

  return (
    <Screen title="Supplier" subtitle="Daftar supplier aglonema" onBack={() => router.back()} floatingNav={false}>
      <Card>
        <Text style={styles.cardTitle}>Tambah supplier</Text>
        <View style={{ height: spacing.sm }} />
        <Field label="Nama" required>
          <Input value={nama} onChangeText={setNama} testID="sup-nama" />
        </Field>
        <Field label="No WhatsApp">
          <Input prefix="+62" value={hp.replace(/^62/, "")} onChangeText={setHp} keyboardType="phone-pad" testID="sup-hp" />
        </Field>
        <Field label="Catatan / alamat">
          <Input value={cat} onChangeText={setCat} multiline testID="sup-cat" />
        </Field>
        <Button title="Tambah supplier" icon="person-add-outline" onPress={tambah} testID="sup-tambah" />
      </Card>

      {state.suppliers.length === 0 && (
        <Card>
          <Text style={styles.muted}>Belum ada supplier</Text>
        </Card>
      )}

      {state.suppliers.map((s) => {
        const m = perSup[s.id] ?? { count: 0, hpp: 0 };
        return (
          <Card key={s.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.cardTitle}>{s.nama}</Text>
              <Pressable onPress={() => hapus(s.id)}>
                <Ionicons name="trash-outline" size={20} color={colors.accent} />
              </Pressable>
            </View>
            {s.hp && (
              <Pressable onPress={() => Linking.openURL(`https://wa.me/${s.hp}`)}>
                <Text style={styles.link}>{displayWA(s.hp)}</Text>
              </Pressable>
            )}
            {s.cat ? <Text style={[styles.muted, { marginTop: 4 }]}>{s.cat}</Text> : null}
            <Text style={[styles.muted, { marginTop: 6 }]}>
              {m.count} catatan persediaan · Total HPP {formatRp(m.hpp)}
            </Text>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: 13 },
  link: { fontFamily: fonts.semibold, color: colors.brandPrimary, marginTop: 4 },
});
