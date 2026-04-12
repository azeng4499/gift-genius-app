import { Text, TextProps } from "react-native";

export type ThemedTextProps = TextProps & {
  className?: string;
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  inverse?: boolean;
};

type FontStyle = "display" | "rounded" | "serif";

type FontWeight =
  | "ultralight"
  | "light"
  | "thin"
  | "regular"
  | "medium"
  | "semibold"
  | "bold";

const fontStyleMap = {
  display: {
    ultralight: "font-sf-display-ultra-light",
    thin: "font-sf-display-thin",
    light: "font-sf-display-light",
    regular: "font-sf-display-regular",
    medium: "font-sf-display-medium",
    semibold: "font-sf-display-semibold",
    bold: "font-sf-display-bold",
  },
  rounded: {
    ultralight: "font-sf-rounded-ultra-light",
    thin: "font-sf-rounded-thin",
    light: "font-sf-rounded-light",
    regular: "font-sf-rounded-regular",
    medium: "font-sf-rounded-medium",
    semibold: "font-sf-rounded-semibold",
    bold: "font-sf-rounded-bold",
  },
  serif: {
    ultralight: "font-noto-serif-medium",
    thin: "font-noto-serif-medium",
    light: "font-noto-serif-medium",
    regular: "font-noto-serif-medium",
    medium: "font-noto-serif-medium",
    semibold: "font-noto-serif-semibold",
    bold: "font-noto-serif-bold",
  },
};

export function ThemedText({
  className = "",
  fontStyle = "display",
  fontWeight = "regular",
  inverse = false,
  ...rest
}: ThemedTextProps) {
  const textColor = inverse
    ? "text-theme-dark-text dark:text-theme-light-text"
    : "text-theme-light-text dark:text-theme-dark-text";

  return (
    <Text
      className={`${textColor} ${fontStyleMap[fontStyle][fontWeight]} ${className}`}
      {...rest}
    />
  );
}
