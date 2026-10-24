import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, shadow, spacing } from "../theme";

/* ---------------- Card ---------------- */
export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; testID?: string }) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

/* ---------------- Button ---------------- */
type BtnKind = "primary" | "alt" | "out" | "danger" | "ghost";
export function Button({
  title,
  onPress,
  kind = "primary",
  icon,
  testID,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  kind?: BtnKind;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  const palette = {
    primary: { bg: colors.brandPrimary, fg: colors.onBrandPrimary, border: colors.brandPrimary },
    alt: { bg: colors.brandSecondary, fg: colors.onBrandSecondary, border: colors.brandSecondary },
    out: { bg: "transparent", fg: colors.brandPrimary, border: colors.brandPrimary },
    danger: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    ghost: { bg: "transparent", fg: colors.brandPrimary, border: "transparent" },
  }[kind];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
        style as ViewStyle,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={palette.fg} style={{ marginRight: 8 }} />}
      <Text style={[styles.btnText, { color: palette.fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
    </Pressable>
  );
}

/* ---------------- Chip ---------------- */
export function Chip({
  label,
  active,
  onPress,
  color,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: "green" | "pink" | "muted";
  testID?: string;
}) {
  const bg =
    color === "pink" ? colors.accentMuted : color === "muted" ? colors.surfaceTertiary : colors.brandSecondary;
  const fg =
    color === "pink" ? colors.onAccentMuted : color === "muted" ? colors.muted : colors.onBrandSecondary;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[styles.chip, { backgroundColor: bg }, active && { borderWidth: 1.5, borderColor: fg }]}
    >
      <Text style={{ fontFamily: fonts.semibold, color: fg, fontSize: fontSize.sm }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/* ---------------- Field ---------------- */
export function Field({
  label,
  required,
  children,
  hint,
  style,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={{ color: colors.accent }}> *</Text> : null}
      </Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/* ---------------- Input ---------------- */
export function Input({
  prefix,
  style,
  ...rest
}: TextInputProps & { prefix?: string }) {
  return (
    <View style={styles.inputWrap}>
      {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, prefix ? { paddingLeft: 0 } : null, style]}
        {...rest}
      />
    </View>
  );
}

/* ---------------- Picker (bottom sheet) ---------------- */
export function Picker<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Pilih",
  testID,
  renderOption,
  labelFor,
}: {
  value: T | "";
  options: readonly T[];
  onChange: (v: T) => void;
  placeholder?: string;
  testID?: string;
  renderOption?: (v: T) => React.ReactNode;
  labelFor?: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const display = value ? (labelFor ? labelFor(value as T) : (value as string)) : placeholder;

  return (
    <>
      <Pressable style={styles.pickerBtn} onPress={() => setOpen(true)} testID={testID}>
        <Text style={[styles.pickerText, !value && { color: colors.muted }]} numberOfLines={1}>{display}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{placeholder}</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {options.map((o) => (
                <Pressable
                  key={o}
                  style={({ pressed }) => [styles.pickerItem, pressed && { backgroundColor: colors.surfaceTertiary }]}
                  onPress={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  testID={`picker-item-${o}`}
                >
                  {renderOption ? renderOption(o) : <Text style={styles.pickerItemText}>{labelFor ? labelFor(o) : o}</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Button title="Tutup" kind="alt" onPress={() => setOpen(false)} style={{ marginTop: spacing.md }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* ---------------- Section Title ---------------- */
export function SectionTitle({ n, title }: { n?: number; title: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      {typeof n === "number" ? (
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{n}</Text>
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

/* ---------------- Divider ---------------- */
export function Divider({ v = spacing.md }: { v?: number }) {
  return <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: v }} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
  },
  btnText: { fontFamily: fonts.bold, fontSize: fontSize.lg - 1 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  label: { fontFamily: fonts.semibold, fontSize: fontSize.base - 1, color: colors.onSurface, marginBottom: 6 },
  hint: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.muted, marginTop: 4 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 2,
    paddingHorizontal: spacing.md,
  },
  prefix: { fontFamily: fonts.body, color: colors.muted, fontSize: fontSize.lg, marginRight: 6 },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.onSurface, paddingVertical: 13 },
  pickerBtn: {
    minHeight: 50,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 2,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontFamily: fonts.medium, color: colors.onSurface, fontSize: fontSize.lg, flex: 1 },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(11,31,22,0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface, marginBottom: spacing.md },
  pickerItem: {
    paddingVertical: 13,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  pickerItemText: { fontFamily: fonts.medium, fontSize: fontSize.lg - 1, color: colors.onSurface },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  sectionBadgeText: { fontFamily: fonts.bold, color: colors.onBrandPrimary, fontSize: fontSize.sm },
  sectionTitle: { fontFamily: fonts.display, fontSize: fontSize.lg + 1, color: colors.onSurface },
});
