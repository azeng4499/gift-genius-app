import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { ActivityIndicator, Pressable } from "react-native";

type CtaButtonProps = React.ComponentProps<typeof Pressable> & {
  label: string;
  loading?: boolean;
};

/**
 * Full-width pill CTA — the primary action button across the app
 * (sign in, sign up, etc.). Wraps Pressable, so it accepts onPress,
 * disabled, and any extra className to tweak spacing per screen.
 */
export function CtaButton({
  label,
  loading = false,
  disabled,
  className,
  ...props
}: CtaButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      className={cn(
        "w-full flex-row items-center justify-center rounded-full bg-primary py-5",
        isDisabled && "opacity-60",
        className
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text
          variant="small"
          className="font-bold text-white"
          fontStyle="sf-rounded-semibold"
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
