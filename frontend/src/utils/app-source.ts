import { NativeModules, Platform } from "react-native";

// Dari mana aplikasi dipasang. Play Store = "com.android.vending", App Store = "AppStore".
// Expo Go / web / APK dari ShareIt dll. menghasilkan nilai lain sehingga ditolak server
// (kecuali email pemilik).
let cached: string | null = null;

export function appSource(): string {
  if (cached !== null) return cached;
  cached = "unknown";
  if (Platform.OS === "web") {
    cached = "web";
  } else if (NativeModules.RNDeviceInfo) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const DeviceInfo = require("react-native-device-info").default;
      cached = String(DeviceInfo.getInstallerPackageNameSync() || "unknown");
    } catch {
      cached = "unknown";
    }
  }
  return cached;
}
