import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, TextInput, View } from "react-native";

type AuthInputProps = React.ComponentProps<typeof TextInput> &
  React.RefAttributes<TextInput> & {
    // Swap the underlying input, e.g. BottomSheetTextInput inside a bottom
    // sheet. Defaults to react-native's TextInput so it works anywhere.
    InputComponent?: React.ComponentType<React.ComponentProps<typeof TextInput>>;
  };

/**
 * Filled, rounded auth text field shared by sign-in / sign-up.
 * When `secureTextEntry` is set it automatically renders a show/hide eye toggle.
 */
export function AuthInput({
  className,
  secureTextEntry,
  InputComponent = TextInput,
  ...props
}: AuthInputProps) {
  const [visible, setVisible] = React.useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View className="relative justify-center">
      <InputComponent
        placeholderTextColor="#94a3b8"
        secureTextEntry={isPassword && !visible}
        className={cn(
          "bg-white p-4 rounded-xl border border-slate-300 font-sf-rounded-medium",
          isPassword && "pr-12",
          className
        )}
        {...props}
      />
      {isPassword ? (
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-0 bottom-0 items-center justify-center"
        >
          {visible ? (
            <EyeOff size={20} color="#64748b" />
          ) : (
            <Eye size={20} color="#64748b" />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
