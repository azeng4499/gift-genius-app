import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { forwardRef, useCallback, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionSheet, type ActionSheetRef } from "@/components/ui/action-sheet";
import { Text } from "@/components/ui/text";

export type SelectSheetItem = {
  id: string;
  title: string;
  subtitle?: string;
};

// Imperative handle the parent uses to open/close the sheet.
export type SelectSheetRef = ActionSheetRef;

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
 * sheet surface, plus an optional primary CTA that navigates elsewhere.
 * Selection is signaled by a green outline and a filled check dot. Drive it via
 * a `SelectSheetRef` (`present` / `dismiss`).
 */
export const SelectSheet = forwardRef<SelectSheetRef, SelectSheetProps>(
  function SelectSheet(
    { heading, subheading, data, selectedId, onSelect, ctaLabel, ctaIcon, ctaSlug },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<ActionSheetRef>(null);

    // Expose the inner sheet's imperative handle to the parent.
    const setRef = useCallback(
      (node: ActionSheetRef | null) => {
        sheetRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const hasCta = Boolean(ctaLabel && ctaSlug);

    const onCtaPress = useCallback(() => {
      if (!ctaSlug) return;
      sheetRef.current?.dismiss();
      router.push(ctaSlug as never);
    }, [ctaSlug]);

    return (
      <ActionSheet ref={setRef}>
        <View className="px-4 pt-2">
          <Text
            className="text-left text-xl text-slate-700"
            fontStyle="noto-serif-bold"
          >
            {heading}
          </Text>
          {subheading ? (
            <Text
              className="px-1 pb-4 pt-1 text-left"
              fontStyle="sf-display-light"
            >
              {subheading}
            </Text>
          ) : (
            <View className="pb-3" />
          )}
        </View>

        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: hasCta ? 8 : 16 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>

        {hasCta ? (
          <View
            className="px-4 pt-2"
            style={{ paddingBottom: 16 + insets.bottom }}
          >
            <Pressable
              className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-zinc-900"
              onPress={onCtaPress}
            >
              {typeof ctaLabel === "string" ? (
                <Text className="text-center font-sf-display-semibold text-[16px] text-white">
                  {ctaLabel}
                </Text>
              ) : (
                ctaLabel
              )}
              {ctaIcon}
            </Pressable>
          </View>
        ) : null}
      </ActionSheet>
    );
  },
);
