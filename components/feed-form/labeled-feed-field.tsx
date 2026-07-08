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
    <View className={`gap-1.5 ${className ?? ""}`} {...rest}>
      <Text className="font-sf-display-medium text-[15px] text-zinc-900">{label}</Text>
      {hint ? (
        <Text className="-mt-0.5 text-[13px] leading-snug text-zinc-500">{hint}</Text>
      ) : null}
      {children}
    </View>
  );
}
