import type { Config } from "tailwindcss";

const { hairlineWidth } = require("nativewind/theme");

export default {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // --- React Native Reusables design tokens (driven by global.css) ---
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "sheet-surface": "hsl(var(--sheet-surface))",
        "sheet-highlight": "hsl(var(--sheet-highlight))",
        // --- Legacy app colors (kept until pages are migrated off them) ---
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
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
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
