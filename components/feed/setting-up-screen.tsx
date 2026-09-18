import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GiftLoadingView } from "@/components/ui/gift-loader";

// Airy sage-to-white wash that ties the loading states to the app's sheet
// surface, so they never read as a blank white spinner screen.
const BACKDROP = ["#F4F8F6", "#FFFFFF"] as const;

type LoadingStateProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

/**
 * Centered gift-medallion loader + copy, shared by the full-screen bootstrap
 * state and the in-feed loading overlays so every loading moment reads the same.
 */
export function LoadingState({
  title = "Setting up your gifts",
  subtitle = "Getting your lists ready.",
  compact = false,
}: LoadingStateProps = {}) {
  return <GiftLoadingView title={title} subtitle={subtitle} compact={compact} />;
}

/** Absolute-fill loading layer for in-feed states, over the sage wash. */
export function LoadingOverlay({ title, subtitle, compact }: LoadingStateProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={BACKDROP} style={StyleSheet.absoluteFill} />
      <View className="flex-1 items-center justify-center">
        <LoadingState title={title} subtitle={subtitle} compact={compact} />
      </View>
    </View>
  );
}

/** Full-screen "getting ready" state shown while we bootstrap the user + feed. */
export function SettingUpScreen() {
  return (
    <View className="flex-1">
      <LinearGradient colors={BACKDROP} style={StyleSheet.absoluteFill} />
      <SafeAreaView className="flex-1 items-center justify-center">
        <StatusBar style="dark" />
        <LoadingState />
      </SafeAreaView>
    </View>
  );
}

/** Full-screen state shown while the selected feed loads. */
export function SwitchingFeedScreen({ name }: { name: string }) {
  return (
    <View className="flex-1">
      <LinearGradient colors={BACKDROP} style={StyleSheet.absoluteFill} />
      <SafeAreaView
        className="flex-1 items-center justify-center"
        edges={["top", "left", "right"]}
      >
        <StatusBar style="dark" />
        <LoadingState
          title={`Finding gifts for ${name}`}
          subtitle="Hand-picking ideas they’ll love."
        />
      </SafeAreaView>
    </View>
  );
}
