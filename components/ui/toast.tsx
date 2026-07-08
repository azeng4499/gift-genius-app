/**
 * Lightweight, professional toast system.
 *
 * Wrap the app in <ToastProvider> once, then call useToast().show({...})
 * from anywhere. One toast shows at a time; a new one replaces the current.
 */

import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Bookmark, Check, Info, TriangleAlert } from "lucide-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type ToastVariant = "success" | "error" | "info" | "saved";

export type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. Defaults to 2200. */
  durationMs?: number;
};

type ToastContextValue = {
  show: (options: ToastOptions) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof Check; tint: string; haptic: Haptics.NotificationFeedbackType | null }
> = {
  success: { icon: Check, tint: "#1f7a5c", haptic: Haptics.NotificationFeedbackType.Success },
  saved: { icon: Bookmark, tint: "#1f7a5c", haptic: Haptics.NotificationFeedbackType.Success },
  info: { icon: Info, tint: "#3f3f46", haptic: null },
  error: { icon: TriangleAlert, tint: "#b42318", haptic: Haptics.NotificationFeedbackType.Error },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    opacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(-120, { duration: 220 }, (finished) => {
      if (finished) runOnJS(setToast)(null);
    });
  }, [clearTimer, opacity, translateY]);

  const show = useCallback(
    (options: ToastOptions) => {
      clearTimer();
      setToast(options);
      const variant = options.variant ?? "info";
      const haptic = VARIANT_STYLES[variant].haptic;
      if (haptic) Haptics.notificationAsync(haptic).catch(() => {});
      translateY.value = withTiming(0, { duration: 260 });
      opacity.value = withTiming(1, { duration: 200 });
      timerRef.current = setTimeout(hide, options.durationMs ?? 2200);
    },
    [clearTimer, hide, opacity, translateY]
  );

  useEffect(() => clearTimer, [clearTimer]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const variant = toast?.variant ?? "info";
  const { icon: Icon, tint } = VARIANT_STYLES[variant];

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: "absolute",
              top: insets.top + 8,
              left: 16,
              right: 16,
              zIndex: 1000,
            },
            animatedStyle,
          ]}
        >
          <Pressable onPress={hide} accessibilityRole="alert">
            <BlurView
              intensity={40}
              tint="light"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 14,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.06)",
                backgroundColor: "rgba(255,255,255,0.92)",
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              <View
                style={{
                  height: 28,
                  width: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tint,
                }}
              >
                <Icon size={16} color="white" strokeWidth={2.5} />
              </View>
              <Text
                className="flex-1 font-sf-display-medium text-[15px] text-zinc-900"
                numberOfLines={3}
              >
                {toast.message}
              </Text>
            </BlurView>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback keeps callers safe if used outside the provider.
    return { show: () => {}, hide: () => {} };
  }
  return ctx;
}
