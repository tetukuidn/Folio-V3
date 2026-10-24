// Design tokens for folio — lembar pembukuan penjualan aglonema. Light theme only.
import { useMemo } from "react";
import { Appearance, Dimensions, Platform, StyleSheet, useColorScheme } from "react-native";

// Moderate responsive scale: 390pt (iPhone 14/15) is the design baseline.
// Clamped so small Androids stay readable and tablets don't blow up.
const BASE_WIDTH = 390;
const shortestSide = (() => {
  const { width, height } = Dimensions.get("window");
  return Math.min(width, height);
})();
export const sizeRatio = Math.min(Math.max(shortestSide / BASE_WIDTH, 0.88), 1.12);
/** moderate-scale a design value for the current device width */
export const ms = (n: number) => Math.round(n * sizeRatio);

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#F1F5F0",
  onSurface: "#111A15",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#111A15",
  surfaceTertiary: "#E4EDE7",
  onSurfaceTertiary: "#1F5A41",
  surfaceInverse: "#1F5A41",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6A7D73",

  // Brand (hijau)
  brand: "#1F5A41",
  onBrand: "#FFFFFF",
  brandPrimary: "#1F5A41",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#D5E3DB",
  onBrandSecondary: "#1F5A41",
  brandTertiary: "#F0F7F2",
  onBrandTertiary: "#1F5A41",

  // Accent (pink)
  accent: "#C42F5C",
  onAccent: "#FFFFFF",

  // Action / FAB (hijau terang dari logo)
  action: "#17C06B",
  onAction: "#FFFFFF",
  accentMuted: "#FBE6EC",
  onAccentMuted: "#C42F5C",

  // Status
  success: "#287D56",
  onSuccess: "#FFFFFF",
  warning: "#E89B17",
  onWarning: "#111A15",
  error: "#D93847",
  onError: "#FFFFFF",
  info: "#20688A",
  onInfo: "#FFFFFF",

  // Lines
  border: "#D5E3DB",
  borderStrong: "#A6C2B3",
  divider: "#E2EBE5",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "dark" && themes.dark ? "dark" : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const colors = light;

export const spacing = {
  xs: ms(4),
  sm: ms(8),
  md: ms(12),
  lg: ms(16),
  xl: ms(24),
  xxl: ms(32),
  xxxl: ms(48),
};
export const radius = { sm: 6, md: 12, lg: 20, xl: 28, pill: 999 };

// Soft sage gradient used as the app background
export const bgGradient = ["#E6F0E8", "#F1F5F0", "#DCEAE1"] as const;

// Typography (loaded in app/_layout.tsx via expo-font)
export const fonts = {
  display: "Outfit-Bold",
  displaySemi: "Outfit-SemiBold",
  body: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
};

export const fontSize = {
  sm: ms(12),
  base: ms(14),
  lg: ms(16),
  xl: ms(20),
  xxl: ms(24),
  xxxl: ms(32),
  display: ms(44),
};

export const shadow = {
  card: Platform.select({
    ios: { shadowColor: "#1F5A41", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 2 },
    default: { boxShadow: "0 6px 18px rgba(31,90,65,0.08)" },
  }) as object,
  float: Platform.select({
    ios: { shadowColor: "#0B1F16", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 12 },
    default: { boxShadow: "0 10px 26px rgba(11,31,22,0.25)" },
  }) as object,
};

// Floating pill navigation geometry
export const nav = {
  barHeight: Math.max(60, ms(64)),
  sideInset: ms(16),
  bottomGap: ms(10),
  fabSize: Math.max(56, ms(60)),
  fabLift: ms(22), // how much the FAB rises above the pill's top edge
  contentBottomPad: Math.max(124, ms(132)),
  maxWidth: 520, // keep the pill thumb-reachable on tablets
};
