import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { ActivityIndicator, Pressable } from "react-native";

type CtaVariant = "primary" | "dark" | "outline";

type CtaButtonProps = React.ComponentProps<typeof Pressable> & {
  label: string;
  loading?: boolean;
  /** Visual style: brand green, filled black, or black-outlined white. */
  variant?: CtaVariant;
  /** Optional element rendered after the label (e.g. an icon). */
  icon?: React.ReactNode;
};

const VARIANT_STYLES: Record<
  CtaVariant,
  { container: string; text: string; spinner: string }
> = {
  primary: { container: "bg-primary", text: "text-white", spinner: "white" },
  dark: { container: "bg-black", text: "text-white", spinner: "white" },
  outline: {
    container: "border border-black bg-white",
    text: "text-black",
    spinner: "black",
  },
};

/**
 * Full-width pill CTA — the primary action button across the app
 * (sign in, sign up, etc.). Wraps Pressable, so it accepts onPress,
 * disabled, and any extra className to tweak spacing per screen.
 */
export function CtaButton({
  label,
  loading = false,
  variant = "primary",
  icon,
  disabled,
  className,
  ...props
}: CtaButtonProps) {
  const isDisabled = disabled || loading;
  const styles = VARIANT_STYLES[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      className={cn(
        "w-full flex-row items-center justify-center gap-2 rounded-full py-5",
        styles.container,
        isDisabled && "opacity-60",
        className
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={styles.spinner} />
      ) : (
        <>
          <Text
            variant="small"
            className={cn("font-bold", styles.text)}
            fontStyle="sf-rounded-semibold"
          >
            {label}
          </Text>
          {icon}
        </>
      )}
    </Pressable>
  );
}
