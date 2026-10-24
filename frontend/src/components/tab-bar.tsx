import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TabTriggerSlotProps } from "expo-router/ui";
import { useRouter } from "expo-router";
import { colors, fonts, fontSize, nav, radius, shadow, spacing } from "../theme";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  dashboard: "stats-chart",
  pesanan: "receipt",
  customer: "cart",
  ekspor: "cloud-upload",
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
        <View style={{ width: nav.fabSize + fabGap }} />
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
          <Ionicons name="add" size={Math.round(nav.fabSize * 0.52)} color={colors.onAction} />
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
      <Ionicons
        name={focused ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)}
        size={20}
        color={focused ? colors.brandPrimary : "rgba(255,255,255,0.78)"}
      />
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

const styles = StyleSheet.create({
  wrap: { position: "absolute" },
  pill: {
    height: nav.barHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
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
  tabActive: {
    backgroundColor: colors.surfaceSecondary,
  },
  tabLabel: {
    fontFamily: fonts.semibold,
    fontSize: Math.max(10, fontSize.sm - 2),
    color: colors.brandPrimary,
    flexShrink: 1,
  },
  tabLabelIdle: { color: "rgba(255,255,255,0.82)", fontFamily: fonts.medium },
  fabWrap: {
    position: "absolute",
    pointerEvents: "box-none",
    left: 0,
    right: 0,
    bottom: nav.barHeight - nav.fabSize + nav.fabLift,
    alignItems: "center",
  },
  fab: {
    width: nav.fabSize,
    height: nav.fabSize,
    borderRadius: radius.pill,
    backgroundColor: colors.action,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadow.float,
  },
});
