import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetBackground } from "@/components/ui/sheet-background";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_RADIUS = 15;

// Imperative handle the parent uses to open/close the sheet — same shape the
// @gorhom-backed sheets exposed, so call sites don't change.
export type ActionSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type ActionSheetProps = {
  children: React.ReactNode;
  onDismiss?: () => void;
};

/**
 * Bottom sheet built on React Native's core Modal + Animated — deliberately
 * free of Reanimated / @gorhom, which stall under Reanimated 4. Slides up over a
 * dimmed backdrop, dismisses on backdrop tap, Android back, or a downward drag
 * on the grabber. Content sizes to its children (capped at the screen). Drive it
 * via an ActionSheetRef (`present` / `dismiss`); the sage surface + grabber match
 * the previous sheets.
 */
export const ActionSheet = forwardRef<ActionSheetRef, ActionSheetProps>(
  function ActionSheet({ children, onDismiss }, ref) {
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);

    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    // Latest measured sheet height, used as the closed/off-screen offset so the
    // slide distance tracks the actual content height.
    const sheetHeight = useRef(SCREEN_HEIGHT);

    const animateIn = useCallback(() => {
      translateY.setValue(sheetHeight.current);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    }, [backdropOpacity, translateY]);

    const close = useCallback(() => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: sheetHeight.current,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setVisible(false);
          onDismiss?.();
        }
      });
    }, [backdropOpacity, translateY, onDismiss]);

    useImperativeHandle(
      ref,
      () => ({
        present: () => setVisible(true),
        dismiss: close,
      }),
      [close],
    );

    // PanResponder is created once; route the release through a ref so it always
    // sees the current `close` without rebuilding the responder.
    const closeRef = useRef(close);
    closeRef.current = close;
    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80 || g.vy > 0.8) {
            closeRef.current();
          } else {
            Animated.timing(translateY, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    ).current;

    return (
      <Modal
        visible={visible}
        transparent
        statusBarTranslucent
        animationType="none"
        onShow={animateIn}
        onRequestClose={close}
      >
        <View style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0,0,0,0.5)", opacity: backdropOpacity },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityLabel="Close"
            />
          </Animated.View>

          <Animated.View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) sheetHeight.current = h;
            }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: SCREEN_HEIGHT - insets.top - 24,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              overflow: "hidden",
              transform: [{ translateY }],
            }}
          >
            <SheetBackground
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View
              {...panResponder.panHandlers}
              className="items-center pb-1 pt-2"
            >
              <View
                style={{
                  width: 36,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: "#ccc",
                }}
              />
            </View>
            {children}
          </Animated.View>
        </View>
      </Modal>
    );
  },
);
