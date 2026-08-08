import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";
import { useUnstableNativeVariable } from "nativewind";
import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

const SHEET_RADIUS = 15; // matches @gorhom default background corner radius

// Sheet colors live in global.css as design tokens (HSL triplets); fall back to
// the literal values so the gradient still renders before vars resolve.
function useSheetColor(varName: string, fallback: string) {
  const value = useUnstableNativeVariable(varName);
  return `hsl(${value ?? fallback})`;
}

/**
 * Radial-gradient background for @gorhom bottom sheets — a soft green surface
 * with a highlight near the top edge. Pass as `backgroundComponent`.
 */
export function SheetBackground({
  pointerEvents,
  style,
}: BottomSheetBackgroundProps) {
  const base = useSheetColor("--sheet-surface", "154 16% 91%");
  const highlight = useSheetColor("--sheet-highlight", "151 16% 72%");

  // Measure the container and hand the SVG explicit pixel dimensions. Percentage
  // width/height on <Svg> resolve against the viewport at mount time — inside a
  // lazily-mounted/animating bottom sheet that viewport is often still 0, which
  // collapses the radial gradient into a thin band at the top and never
  // recomputes. Rendering off measured layout avoids that race entirely.
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height
        ? prev
        : { width, height },
    );
  };

  return (
    <View
      pointerEvents={pointerEvents}
      onLayout={onLayout}
      style={[
        style,
        {
          backgroundColor: base,
          borderRadius: SHEET_RADIUS,
          overflow: "hidden",
        },
      ]}
    >
      {size.width > 0 && size.height > 0 ? (
        <Svg
          style={StyleSheet.absoluteFill}
          width={size.width}
          height={size.height}
        >
          <Defs>
            <RadialGradient id="sheetBg" cx="50%" cy="6%" rx="85%" ry="60%">
              <Stop offset="0" stopColor={highlight} stopOpacity={1} />
              <Stop offset="1" stopColor={base} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={size.width}
            height={size.height}
            fill="url(#sheetBg)"
          />
        </Svg>
      ) : null}
    </View>
  );
}
