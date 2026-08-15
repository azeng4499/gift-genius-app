import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetBackground } from "@/components/ui/sheet-background";
import { Text } from "@/components/ui/text";

export type SelectSheetItem = {
  id: string;
  title: string;
  subtitle?: string;
};

// Imperative handle the parent uses to open/close the sheet. Mirrors the
// BottomSheetModal methods this component needs to expose.
export type SelectSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type SelectSheetProps = {
  heading: string;
  subheading?: string;
  data: SelectSheetItem[];
  /** id of the currently-selected row, or null when nothing is selected. */
  selectedId?: string | null;
  onSelect: (item: SelectSheetItem) => void;
  /** CTA contents — a node so callers can swap the label and its icon. Omit
   *  (along with ctaSlug) for a picker with no footer action. */
  ctaLabel?: React.ReactNode;
  ctaIcon?: React.ReactNode;
  /** Route pushed when the CTA is pressed; the sheet dismisses first. */
  ctaSlug?: string;
};

/**
 * Bottom-sheet picker: a titled list of selectable rows over the shared sage
 * sheet surface, plus a primary CTA that navigates elsewhere. Selection is
 * signaled by a green outline and a filled check dot; every row is otherwise
 * styled identically. Drive it via a `SelectSheetRef` (`present`/`dismiss`).
 */
export const SelectSheet = forwardRef<SelectSheetRef, SelectSheetProps>(
  function SelectSheet(
    { heading, subheading, data, selectedId, onSelect, ctaLabel, ctaIcon, ctaSlug },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    const hasCta = Boolean(ctaLabel && ctaSlug);

    const onCtaPress = useCallback(() => {
      if (!ctaSlug) return;
      sheetRef.current?.dismiss();
      router.push(ctaSlug as never);
    }, [ctaSlug]);

    // Sticky CTA pinned to the bottom of the sheet: it stays put while the tile
    // list scrolls behind it. Sits flush at the bottom edge and extends its
    // surface fill (--sheet-surface base) through the bottom safe area so rows
    // never peek out below or beside the pill.
    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={0}>
          <View
            className="px-4 pt-2"
            style={{
              backgroundColor: "#E5ECE9",
              paddingBottom: 16 + insets.bottom,
            }}
          >
            <Pressable
              className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-zinc-900"
              onPress={onCtaPress}
            >
              {ctaIcon}
              {typeof ctaLabel === "string" ? (
                <Text className="text-center font-sf-display-semibold text-[16px] text-white">
                  {ctaLabel}
                </Text>
              ) : (
                ctaLabel
              )}
            </Pressable>
          </View>
        </BottomSheetFooter>
      ),
      [ctaIcon, ctaLabel, insets.bottom, onCtaPress],
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        // Size to content so the sheet only comes out far enough to fit the
        // rows; capped at full height (topInset) after which the list scrolls.
        enableDynamicSizing
        enablePanDownToClose
        topInset={insets.top}
        backdropComponent={renderBackdrop}
        backgroundComponent={SheetBackground}
        footerComponent={hasCta ? renderFooter : undefined}
        handleIndicatorStyle={{ backgroundColor: "#ccc" }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            // Reserve room for the sticky footer so the last row clears it
            // (only when there is a footer CTA).
            paddingBottom: (hasCta ? 96 : 16) + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text
              className="text-left text-xl text-slate-700"
              fontStyle="noto-serif-bold"
            >
              {heading}
            </Text>
            {subheading ? (
              <Text
                className="text-left pb-6 pt-1 px-1"
                fontStyle="sf-display-light"
              >
                {subheading}
              </Text>
            ) : null}
          </View>

          <View className="gap-2.5">
            {data.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <Pressable
                  key={item.id}
                  className="flex-row items-center justify-between rounded-2xl px-4 py-3.5"
                  style={{
                    borderWidth: 2,
                    borderColor: isSelected ? "#1f7a5c" : "transparent",
                    backgroundColor: isSelected
                      ? "rgba(255,255,255,0.7)"
                      : "rgba(255,255,255,0.5)",
                  }}
                  onPress={() => onSelect(item)}
                >
                  <View className="flex-1 pr-3">
                    <Text
                      className="text-base font-sf-display-semibold"
                      style={{ color: "#3f3f46" }}
                    >
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text
                        className="mt-0.5 text-[13px]"
                        style={{ color: "#71717a" }}
                        numberOfLines={1}
                      >
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <View
                      className="h-6 w-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: "#1f7a5c" }}
                    >
                      <Check size={14} color="white" strokeWidth={3} />
                    </View>
                  ) : (
                    <View
                      className="h-6 w-6 rounded-full"
                      style={{ borderWidth: 2, borderColor: "#d4d4d8" }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);
