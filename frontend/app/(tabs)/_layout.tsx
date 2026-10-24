import { Tabs } from "expo-router";
import { FloatingTabBar } from "@/src/components/tab-bar";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="pesanan" options={{ title: "Pesanan" }} />
      <Tabs.Screen name="customer" options={{ title: "Customer" }} />
      <Tabs.Screen name="ekspor" options={{ title: "Ekspor" }} />
    </Tabs>
  );
}
