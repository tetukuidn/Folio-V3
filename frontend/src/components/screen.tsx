import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bgGradient, colors, fonts, fontSize, nav, radius, shadow, spacing } from "../theme";

export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
  footer,
  onBack,
  action,
  floatingNav = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  onBack?: () => void;
  action?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; testID?: string };
  floatingNav?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = floatingNav ? nav.contentBottomPad + insets.bottom : spacing.xxl + insets.bottom;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.circleBtn} hitSlop={10} testID="screen-back">
            <Ionicons name="arrow-back" size={20} color={colors.brandPrimary} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        {action ? (
          <Pressable onPress={action.onPress} style={styles.circleBtn} hitSlop={10} testID={action.testID}>
            <Ionicons name={action.icon} size={20} color={colors.brandPrimary} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );

  return (
    <LinearGradient colors={bgGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomPad, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, padding: spacing.lg }}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", minHeight: 8 },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.xxxl,
    color: colors.onSurface,
    marginTop: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.muted, marginTop: 2 },
});
