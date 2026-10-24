import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { GoogleIcon } from "@/src/components/google-icon";
import { useToast } from "@/src/components/toast";
import { colors, fonts, fontSize, radius, shadow, spacing } from "@/src/theme";

const BG =
  "https://images.unsplash.com/photo-1629099534513-bbc256e2b58a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwxfHxBZ2xhb25lbWElMjBwbGFudCUyMGFlc3RoZXRpY3xlbnwwfHx8fDE3OTE0MzMxODN8MA&ixlib=rb-4.1.0&q=85";

const LOGO = require("../assets/images/logo.png");

export default function LoginScreen() {
  const { signIn, signingIn, error } = useAuth();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { width, height } = useWindowDimensions();

  const logoSize = Math.round(Math.min(Math.max(width * 0.38, 116), 184));
  const compact = height < 700;

  useEffect(() => {
    if (error) toast.show(error);
  }, [error, toast]);

  return (
    <View style={styles.root}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
      <LinearGradient
        colors={["rgba(8,26,19,0.55)", "rgba(8,26,19,0.72)", "rgba(8,26,19,0.95)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={[styles.brand, compact && { gap: spacing.md }]}>
          <Image
            source={LOGO}
            style={{ width: logoSize, height: logoSize }}
            contentFit="contain"
            transition={300}
            accessibilityLabel="folio"
          />
          <Text style={styles.tagline}>Lembar pembukuan penjualan aglonema</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={signingIn ? undefined : signIn}
            disabled={signingIn}
            style={({ pressed }) => [styles.ctaShadow, pressed && { transform: [{ scale: 0.985 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Masuk dengan Google"
            testID="login-google"
          >
            <View style={styles.cta}>
              {signingIn ? (
                <ActivityIndicator color={colors.brandPrimary} />
              ) : (
                <>
                  <GoogleIcon size={Math.round(fontSize.xl)} />
                  <Text style={styles.ctaText} numberOfLines={1}>
                    Masuk dengan Google
                  </Text>
                </>
              )}
            </View>
          </Pressable>

          <View style={styles.assure}>
            <Ionicons name="shield-checkmark-outline" size={fontSize.base} color="rgba(255,255,255,0.72)" />
            <Text style={styles.assureText}>Data pembukuan tersimpan khusus di akunmu</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#081A13" },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
    gap: spacing.xxl,
  },
  brand: { alignItems: "center", gap: spacing.lg },
  tagline: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * 1.4,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    maxWidth: 320,
  },
  actions: { gap: spacing.lg },
  ctaShadow: { ...shadow.float, borderRadius: radius.pill },
  cta: {
    minHeight: Math.max(54, fontSize.lg * 3.4),
    borderRadius: radius.pill,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  // Google brand guidelines: fixed #3C4043 label on the white button
  ctaText: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: "#3C4043" },
  assure: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  assureText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
  },
});
