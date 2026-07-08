import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

type Variant = "dark" | "accent" | "outline";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: ReactNode;
};

/** Full-width pill button — the primary action style across the app. */
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "dark",
  icon,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const bg =
    variant === "accent"
      ? "bg-[#1f7a5c]"
      : variant === "outline"
        ? "bg-white border border-zinc-300"
        : "bg-zinc-900";
  const textColor = variant === "outline" ? "text-zinc-900" : "text-white";
  const spinnerColor = variant === "outline" ? "#18181b" : "#ffffff";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-14 flex-row items-center justify-center gap-2 rounded-full ${bg}`}
      style={{ opacity: isDisabled ? 0.5 : 1 }}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {icon}
          <Text className={`font-sf-display-semibold text-[16px] ${textColor}`}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
