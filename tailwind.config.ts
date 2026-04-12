import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "app-bg": "#121212",
        "card-bg": "#1a1a1a",
        "safe-area-bg": "#ffffff",
        "theme-light": {
          text: "#11181C",
          background: "#F5EFED",
          tint: "#0a7ea4",
          icon: "#687076",
        },
        "theme-dark": {
          text: "#ECEDEE",
          background: "#151718",
          tint: "#fff",
          icon: "#9BA1A6",
        },
      },
      fontFamily: {
        "sf-display-regular": ["SFPro-Display-Regular", "sans-serif"],
        "sf-display-medium": ["SFPro-Display-Medium", "sans-serif"],
        "sf-display-semibold": ["SFPro-Display-Semibold", "sans-serif"],
        "sf-display-light": ["SFPro-Display-Light", "sans-serif"],
        "sf-display-bold": ["SFPro-Display-Bold", "sans-serif"],
        "sf-display-thin": ["SFPro-Display-Thin", "sans-serif"],
        "sf-display-ultra-light": ["SFPro-Display-UltraLight", "sans-serif"],
        "sf-rounded-regular": ["SFPro-Rounded-Regular", "sans-serif"],
        "sf-rounded-medium": ["SFPro-Rounded-Medium", "sans-serif"],
        "sf-rounded-semibold": ["SFPro-Rounded-Semibold", "sans-serif"],
        "sf-rounded-bold": ["SFPro-Rounded-Bold", "sans-serif"],
        "sf-rounded-light": ["SFPro-Rounded-Light", "sans-serif"],
        "sf-rounded-thin": ["SFPro-Rounded-Thin", "sans-serif"],
        "sf-rounded-ultra-light": ["SFPro-Rounded-UltraLight", "sans-serif"],
        "noto-serif-medium": ["NotoSerif-Medium", "sans-serif"],
        "noto-serif-bold": ["NotoSerif-Bold", "sans-serif"],
        "noto-serif-semibold": ["NotoSerif-SemiBold", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
