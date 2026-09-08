import { ChevronLeft } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Text } from "@/components/ui/text";

// Brand green (--primary ≈ hsl(160 60% 30%)).
const BRAND = "#1f7a5c";

type LoadingStateProps = {
  title?: string;
  subtitle?: string;
};

/**
 * Centered spinner + copy, shared by the full-screen bootstrap state and the
 * in-feed loading overlay so both read identically. Copy is overridable.
 */
export function LoadingState({
  title = "Setting things up…",
  subtitle = "Getting your gift lists ready.",
}: LoadingStateProps = {}) {
  return (
    <View className="items-center justify-center px-8">
      <ActivityIndicator size="large" color={BRAND} />
      <Text className="mt-4 text-center font-noto-serif-bold text-base text-zinc-900">
        {title}
      </Text>
      <Text className="mt-1 text-center text-sm text-zinc-500">{subtitle}</Text>
    </View>
  );
}

/** Full-screen "getting ready" state shown while we bootstrap the user + feed. */
export function SettingUpScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white">
      <StatusBar style="dark" />
      <LoadingState />
    </SafeAreaView>
  );
}

/** Full-screen switch overlay with a back control to cancel mid-load. */
export function SwitchingFeedScreen({
  name,
  onBack,
}: {
  name: string;
  onBack: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View className="px-2 pt-1">
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-slate-100"
        >
          <ChevronLeft size={28} color="#0f172a" strokeWidth={2} />
        </Pressable>
      </View>
      <View className="flex-1 items-center justify-center">
        <LoadingState
          title="Getting your feed ready…"
          subtitle={`Finding gifts for ${name}.`}
        />
      </View>
    </SafeAreaView>
  );
}
