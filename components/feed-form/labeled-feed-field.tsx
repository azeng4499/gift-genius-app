import type { ReactNode } from "react";
import { Text, View, type ViewProps } from "react-native";

type LabeledFeedFieldProps = ViewProps & {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function LabeledFeedField({
  label,
  hint,
  children,
  className,
  ...rest
}: LabeledFeedFieldProps) {
  return (
    <View className={`gap-1 ${className ?? ""}`} {...rest}>
      <Text className="text-sm font-medium text-zinc-900">{label}</Text>
      {hint ? (
        <Text className="-mt-0.5 text-xs leading-snug text-zinc-500">{hint}</Text>
      ) : null}
      {children}
    </View>
  );
}
