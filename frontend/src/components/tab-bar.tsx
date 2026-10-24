import React from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, nav, radius, shadow, spacing } from "../theme";

const FAB = Math.round(nav.barHeight * 0.8);

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  dashboard: "grid-outline",
  pesanan: "document-text-outline",
  customer: "people-outline",
  ekspor: "download-outline",
};

type TabItemData = { key: string; name: string; label: string; focused: boolean; onPress: () => void };

type TabBarLikeProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  // SDK 58 (expo-router 58 bottom tabs) passes `emitter` + `navigateToTab`; older versions pass `navigation`.
  emitter?: {
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  };
  navigateToTab?: (routeKey: string) => void;
  navigation?: {
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: never) => void;
  };
};

export function FloatingTabBar({ state, descriptors, emitter, navigateToTab, navigation }: TabBarLikeProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const sideInset = Math.max(narrow ? 10 : nav.sideInset, (width - nav.maxWidth) / 2);
  const fabGap = narrow ? 2 : spacing.md;

  const items: TabItemData[] = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    return {
      key: route.key,
      name: route.name,
      label: options.title || route.name,
      focused: state.index === index,
      onPress: () => {
        const em = emitter ?? navigation;
        const event = em?.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (event?.defaultPrevented) return;
        if (navigateToTab) navigateToTab(route.key);
        else navigation?.navigate(route.name as never);
      },
    };
  });

  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <View
      style={[
        styles.wrap,
        { bottom: insets.bottom + nav.bottomGap, left: sideInset, right: sideInset, pointerEvents: "box-none" },
      ]}
    >
      <View style={styles.pill}>
        <View style={[styles.group, { paddingRight: narrow ? 2 : spacing.sm }]}>
          {left.map(({ key, ...it }) => (
            <TabItem key={key} {...it} />
          ))}
        </View>
        <View style={{ width: FAB + fabGap }} />
        <View style={[styles.group, { paddingLeft: narrow ? 2 : spacing.sm }]}>
          {right.map(({ key, ...it }) => (
            <TabItem key={key} {...it} />
          ))}
        </View>
      </View>

      <View style={styles.fabWrap}>
        <Pressable
          onPress={() => router.push("/pesanan-baru")}
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
          testID="fab-pesanan-baru"
          accessibilityLabel="Pesanan baru"
        >
          <Ionicons name="add" size={Math.round(FAB * 0.6)} color={colors.navBar} />
        </Pressable>
      </View>
    </View>
  );
}

function TabItem({
  name,
  label,
  focused,
  onPress,
}: {
  name: string;
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const icon = ICONS[name] ?? "ellipse";
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, focused && styles.tabActive]}
      testID={`tab-${name}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <Ionicons name={icon} size={22} color={focused ? colors.navActive : colors.navIdle} />
      <Text
        style={[styles.tabLabel, !focused && styles.tabLabelIdle]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Mint glow under the FAB (same in light/dark)
const fabGlow = Platform.select({
  ios: { shadowColor: "#2ECC8F", shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  android: { elevation: 8 },
  default: { boxShadow: "0 0 18px rgba(46,204,143,0.55)" },
}) as object;

const styles = StyleSheet.create({
  wrap: { position: "absolute" },
  pill: {
    height: nav.barHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.navBar,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    ...shadow.float,
  },
  group: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", gap: 2 },
  tab: {
    minHeight: 48,
    minWidth: 40,
    flexShrink: 1,
    paddingHorizontal: 3,
    paddingVertical: 5,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabActive: {},
  tabLabel: {
    fontFamily: fonts.semibold,
    fontSize: Math.max(10, fontSize.sm - 1),
    color: colors.navActive,
    flexShrink: 1,
  },
  tabLabelIdle: { color: colors.navIdle, fontFamily: fonts.medium },
  fabWrap: {
    position: "absolute",
    pointerEvents: "box-none",
    left: 0,
    right: 0,
    bottom: (nav.barHeight - FAB) / 2,
    alignItems: "center",
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: Math.round(FAB * 0.32),
    backgroundColor: colors.navActive,
    alignItems: "center",
    justifyContent: "center",
    ...fabGlow,
  },
});
