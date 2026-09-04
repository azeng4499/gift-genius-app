import { router, Stack } from "expo-router";
import { ChevronDown, ChevronLeft } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HobbyChipPicker } from "@/components/feed-form/hobby-chip-picker";
import { CtaButton } from "@/components/ui/cta-button";
import { useToast } from "@/components/ui/toast";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import {
  SelectSheet,
  type SelectSheetItem,
  type SelectSheetRef,
} from "@/components/ui/select-sheet";
import {
  formatOccasionLabel,
  formatRelationshipLabel,
  RELATIONSHIP_OPTIONS,
} from "@/lib/feed-form-shared";

// Occasions the backend accepts (taxonomy/occasions.txt → createSession enum).
const OCCASION_OPTIONS = [
  "birthday",
  "christmas",
  "mothers_day",
  "fathers_day",
  "anniversary",
  "graduation",
  "housewarming",
  "just_because",
] as const;

// Budget ranges (taxonomy/budget_buckets.txt), picked from a sheet. Each bucket
// carries the min/max the backend needs (budget_max must be > budget_min).
export type BudgetBucket = SelectSheetItem & { min: number; max: number };
export const BUDGET_BUCKETS: BudgetBucket[] = [
  { id: "0-25", title: "Under $25", min: 0, max: 25 },
  { id: "25-50", title: "$25 – $50", min: 25, max: 50 },
  { id: "50-75", title: "$50 – $75", min: 50, max: 75 },
  { id: "75-100", title: "$75 – $100", min: 75, max: 100 },
  { id: "100-150", title: "$100 – $150", min: 100, max: 150 },
  { id: "150-200", title: "$150 – $200", min: 150, max: 200 },
  { id: "200+", title: "$200+", min: 200, max: 1000 },
];

/** Best-effort match of a saved budget range back to a picker bucket, so the
 *  edit screen can pre-select the row. Returns null when nothing lines up. */
export function budgetBucketIdForRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min == null && max == null) return null;
  const exact = BUDGET_BUCKETS.find((b) => b.min === min && b.max === max);
  if (exact) return exact.id;
  // Fall back to the bucket whose range best contains the saved max.
  const byMax = BUDGET_BUCKETS.find((b) => max != null && max <= b.max);
  return byMax?.id ?? null;
}

export type FeedFormValues = {
  name: string;
  relationship: string;
  hobbyIds: string[];
  occasion: string;
  budget: BudgetBucket;
};

export type FeedFormInitialValues = {
  name?: string;
  relationship?: string;
  hobbyIds?: string[];
  occasion?: string;
  budgetBucketId?: string | null;
};

type FeedFormProps = {
  title: string;
  subheading: string;
  ctaLabel: string;
  /** Button style for the primary action. Defaults to the brand-green fill. */
  ctaVariant?: "primary" | "dark" | "outline";
  /** Optional element rendered after the CTA label (e.g. a trailing arrow). */
  ctaIcon?: React.ReactNode;
  initialValues?: FeedFormInitialValues;
  /** Perform the create/update. Throw to surface the message via toast. */
  onSubmit: (values: FeedFormValues) => Promise<void>;
};

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="mb-2 px-1 text-sm text-slate-600"
      fontStyle="sf-display-medium"
    >
      {children}
    </Text>
  );
}

/** Rounded pressable that opens a picker sheet — styled to match AuthInput so
 *  dropdowns and text fields read as the same control family. */
function SelectRow({
  value,
  placeholder,
  accessibilityLabel,
  onPress,
}: {
  value: string | null;
  placeholder: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="flex-row items-center justify-between rounded-xl border border-slate-300 bg-white p-4 active:opacity-70"
    >
      <Text
        className={value ? "text-slate-900" : "text-slate-400"}
        fontStyle="sf-rounded-light"
      >
        {value ?? placeholder}
      </Text>
      <ChevronDown size={20} color="#94a3b8" />
    </Pressable>
  );
}

/**
 * Shared recipient form used by both "Start a new feed" (create) and the edit
 * screen. The only differences between the two are the copy (`title`,
 * `subheading`, `ctaLabel`), the pre-filled `initialValues`, and what happens
 * on submit — all injected via props. Validation, layout, and the picker
 * sheets live here so the two callers stay thin.
 */
export function FeedForm({
  title,
  subheading,
  ctaLabel,
  ctaVariant,
  ctaIcon,
  initialValues,
  onSubmit,
}: FeedFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [relationship, setRelationship] = useState(
    initialValues?.relationship ?? "",
  );
  const [hobbyIds, setHobbyIds] = useState<string[]>(
    initialValues?.hobbyIds ?? [],
  );
  const [occasion, setOccasion] = useState(initialValues?.occasion ?? "");
  const [budgetBucketId, setBudgetBucketId] = useState<string | null>(
    initialValues?.budgetBucketId ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const relationshipSheetRef = useRef<SelectSheetRef>(null);
  const budgetSheetRef = useRef<SelectSheetRef>(null);

  const selectedBudget =
    BUDGET_BUCKETS.find((b) => b.id === budgetBucketId) ?? null;

  const relationshipSelectItems: SelectSheetItem[] = useMemo(
    () =>
      RELATIONSHIP_OPTIONS.map((option) => ({
        id: option,
        title: formatRelationshipLabel(option),
      })),
    [],
  );

  const openRelationshipSheet = () => {
    // Drop the keyboard first, otherwise the sheet slides up behind it.
    Keyboard.dismiss();
    relationshipSheetRef.current?.present();
  };
  const openBudgetSheet = () => {
    Keyboard.dismiss();
    budgetSheetRef.current?.present();
  };

  const showError = (message: string) =>
    toast.show({ message, variant: "error" });

  const handleSubmit = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      showError("Add their name so you know whose feed this is.");
      return;
    }
    if (!relationship) {
      showError("Let us know how you know them.");
      return;
    }
    if (hobbyIds.length === 0) {
      showError("Pick at least one interest.");
      return;
    }
    if (!selectedBudget) {
      showError("Pick a budget range.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmedName,
        relationship,
        hobbyIds,
        occasion,
        budget: selectedBudget,
      });
    } catch (submitError) {
      showError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      {/* Native header buttons get wrapped in an iOS "bubble" that can't be
          removed, so render the header ourselves with a bare chevron. */}
      <Stack.Screen options={{ headerShown: false }} />

      <View className="h-11 justify-center px-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={28} color="#0f172a" strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-2 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // Insets the scroll content by exactly the keyboard height (iOS), so the
        // focused field stays visible with no oversized white gap.
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text
            className="text-left text-xl text-slate-700"
            fontStyle="noto-serif-bold"
          >
            {title}
          </Text>
          <Text
            className="px-1 pb-6 pt-1 text-left"
            fontStyle="sf-display-light"
          >
            {subheading}
          </Text>
        </View>

        {/* Hairline dividers between questions so the form reads as distinct
            steps instead of one continuous block. */}
        <View>
          {/* Name */}
          <View>
            <SectionLabel>Who is this for?</SectionLabel>
            {/* Styled to match SelectRow exactly. The placeholder is rendered as
                a Text overlay (same font path as the value) rather than the
                native TextInput placeholder, whose font-box metrics don't line
                up vertically with the typed text. */}
            <View className="relative h-14 justify-center rounded-xl border border-slate-300 bg-white px-4">
              <TextInput
                value={name}
                onChangeText={setName}
                accessibilityLabel="Their name"
                returnKeyType="done"
                className="p-0 font-sf-rounded-light text-[16px] text-slate-900"
              />
              {name.length === 0 ? (
                <View
                  pointerEvents="none"
                  className="absolute inset-y-0 left-4 justify-center"
                >
                  <Text
                    fontStyle="sf-rounded-light"
                    className="text-[16px] text-slate-400"
                  >
                    e.g. Mom, Jamie
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Separator className="my-6" />

          {/* Relationship (required) */}
          <View>
            <SectionLabel>How do you know them?</SectionLabel>
            <SelectRow
              value={
                relationship ? formatRelationshipLabel(relationship) : null
              }
              placeholder="Select a relationship"
              accessibilityLabel="Select a relationship"
              onPress={openRelationshipSheet}
            />
          </View>

          <Separator className="my-6" />

          {/* Interests */}
          <View>
            <SectionLabel>What are they into?</SectionLabel>
            <HobbyChipPicker selectedIds={hobbyIds} onChange={setHobbyIds} />
          </View>

          <Separator className="my-6" />

          {/* Occasion */}
          <View>
            <SectionLabel>What’s the occasion?</SectionLabel>
            <View className="flex-row flex-wrap gap-2">
              {OCCASION_OPTIONS.map((option) => {
                const isSelected = occasion === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setOccasion(isSelected ? "" : option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    className={`rounded-full px-3.5 py-1.5 active:opacity-80 border-2 ${
                      isSelected
                        ? "border-primary bg-primary/70"
                        : "border-slate-200 bg-slate-100"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected ? "text-white" : "text-slate-700"
                      }`}
                      fontStyle="sf-display-medium"
                    >
                      {formatOccasionLabel(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Separator className="my-6" />

          {/* Budget */}
          <View>
            <SectionLabel>What’s your budget?</SectionLabel>
            <SelectRow
              value={selectedBudget?.title ?? null}
              placeholder="Pick a range"
              accessibilityLabel="Pick a range"
              onPress={openBudgetSheet}
            />
          </View>
        </View>
      </ScrollView>

      {/* Pinned primary action. Sits below the scroll area so it stays put at
          the bottom while typing instead of riding up with the keyboard. */}
      <View className="bg-white px-6 pb-2 pt-3">
        <CtaButton
          label={ctaLabel}
          variant={ctaVariant}
          icon={ctaIcon}
          onPress={handleSubmit}
          loading={submitting}
        />
      </View>

      <SelectSheet
        ref={relationshipSheetRef}
        heading="How do you know them?"
        subheading="Select a relationship"
        data={relationshipSelectItems}
        selectedId={relationship || null}
        onSelect={(item) => {
          setRelationship((prev) => (prev === item.id ? "" : item.id));
          relationshipSheetRef.current?.dismiss();
        }}
      />

      <SelectSheet
        ref={budgetSheetRef}
        heading="What’s your budget?"
        subheading="Pick a range."
        data={BUDGET_BUCKETS}
        selectedId={budgetBucketId}
        onSelect={(item) => {
          setBudgetBucketId(item.id);
          budgetSheetRef.current?.dismiss();
        }}
      />
    </SafeAreaView>
  );
}
