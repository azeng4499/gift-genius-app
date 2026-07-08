import { forwardRef, useState } from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";

type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: boolean;
};

/** Soft, rounded text input with a subtle focus ring — clean and unfussy. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, className, onFocus, onBlur, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const border = error
    ? "border-red-400"
    : focused
      ? "border-zinc-900"
      : "border-zinc-200";

  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="font-sf-display-medium text-[15px] text-zinc-900">
          {label}
        </Text>
      ) : null}
      {hint ? (
        <Text className="-mt-0.5 text-[13px] leading-snug text-zinc-500">
          {hint}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#a1a1aa"
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={`rounded-2xl border ${border} bg-white px-4 py-3.5 font-sf-display-regular text-[16px] text-zinc-900 ${className ?? ""}`}
        {...rest}
      />
    </View>
  );
});
