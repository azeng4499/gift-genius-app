import { Gift } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Text } from "@/components/ui/text";

const GREEN = "#1f7a5c";
const GREEN_DEEP = "#16624a";
const TRACK = "rgba(31,122,92,0.14)";

/**
 * The app's signature loading mark: a soft white medallion holding a gift glyph,
 * encircled by a faint brand-green track with one sweeping arc. The medallion
 * breathes while the arc sweeps — a single motion system, not a stock spinner.
 * Uses core Animated (not Reanimated) so it stays reliable, and freezes when the
 * OS reduce-motion setting is on.
 */
export function GiftLoader({ size = 92 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (mounted) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (on) => setReduceMotion(on),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    spinLoop.start();
    breatheLoop.start();
    return () => {
      spinLoop.stop();
      breatheLoop.stop();
    };
  }, [reduceMotion, spin, breathe]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const scale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const stroke = Math.max(3, Math.round(size * 0.045));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.28;
  const medallion = size * 0.72;
  const glyph = Math.round(size * 0.34);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          transform: [{ rotate }],
        }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={TRACK}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={GREEN}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference - arc}`}
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          width: medallion,
          height: medallion,
          borderRadius: medallion,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(31,122,92,0.10)",
          shadowColor: GREEN,
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 3,
          transform: [{ scale }],
        }}
      >
        <Gift size={glyph} color={GREEN_DEEP} strokeWidth={1.75} />
      </Animated.View>
    </View>
  );
}

type GiftLoadingViewProps = {
  title?: string;
  subtitle?: string;
  /** Small single-line variant for in-place states like "loading more". */
  compact?: boolean;
};

/**
 * The gift medallion plus its copy, centered. `compact` shrinks it for in-feed
 * states; the full variant carries a serif headline and a light subtitle.
 */
export function GiftLoadingView({
  title,
  subtitle,
  compact = false,
}: GiftLoadingViewProps) {
  if (compact) {
    return (
      <View className="items-center">
        <GiftLoader size={48} />
        {title ? (
          <Text
            className="mt-3 text-center text-[13px] text-slate-500"
            fontStyle="sf-display-light"
          >
            {title}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="items-center px-8">
      <GiftLoader size={92} />
      {title ? (
        <Text
          className="mt-6 text-center text-[22px] leading-8 text-slate-900"
          fontStyle="noto-serif-bold"
        >
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text
          className="mt-1.5 text-center text-sm text-slate-500"
          fontStyle="sf-display-light"
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
