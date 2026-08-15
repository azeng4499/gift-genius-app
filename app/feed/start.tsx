import { router, Stack } from "expo-router";
import { ArrowRight, ChevronDown, ChevronLeft, Plus } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CtaButton } from "@/components/ui/cta-button";
import { Text } from "@/components/ui/text";
import {
  SelectSheet,
  type SelectSheetItem,
  type SelectSheetRef,
} from "@/components/ui/select-sheet";
import { getApiClient } from "@/lib/api";
import { loadProfilesForUser } from "@/lib/api/bootstrap";
import type { FeedDto } from "@/lib/api/client";
import {
  formatOccasionLabel,
  formatRelationshipLabel,
  OCCASION_OPTIONS,
} from "@/lib/feed-form-shared";
import { getCurrentUserId } from "@/lib/state/user-context";

// Budget ranges, picked from a sheet instead of typed as min/max.
const BUDGET_BUCKETS: SelectSheetItem[] = [
  { id: "0-25", title: "Under $25" },
  { id: "25-50", title: "$25 – $50" },
  { id: "50-100", title: "$50 – $100" },
  { id: "100-250", title: "$100 – $250" },
  { id: "250+", title: "$250+" },
];

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

export default function StartFeedScreen() {
  const api = useMemo(() => getApiClient(), []);

  const [profiles, setProfiles] = useState<FeedDto[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [occasion, setOccasion] = useState("");
  const [budgetBucketId, setBudgetBucketId] = useState<string | null>(null);
  const profileSheetRef = useRef<SelectSheetRef>(null);
  const budgetSheetRef = useRef<SelectSheetRef>(null);

  // Load the user's people so they can pick one from the dropdown.
  useEffect(() => {
    const userId = getCurrentUserId();
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await loadProfilesForUser(api, userId);
        if (!cancelled) setProfiles(result);
      } catch {
        /* leave the dropdown empty if this fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const selectedProfile =
    profiles.find((p) => p.id === selectedProfileId) ?? null;
  const selectedBudget =
    BUDGET_BUCKETS.find((b) => b.id === budgetBucketId) ?? null;

  // Profile rows for the picker sheet. A profile is the person (not a feed), so
  // the subtitle summarizes who they are — relationship • hobbies — with no
  // occasion or budget (those belong to a feed).
  const profileSelectItems: SelectSheetItem[] = useMemo(
    () =>
      profiles.map((profile) => {
        const relation = profile.relationship
          ? formatRelationshipLabel(profile.relationship)
          : null;
        const hobbies =
          profile.interests.length > 0 ? profile.interests.join(", ") : null;
        const subtitle = [relation, hobbies].filter(Boolean).join(" • ");
        return {
          id: profile.id,
          title: profile.name,
          subtitle: subtitle.length > 0 ? subtitle : undefined,
        };
      }),
    [profiles],
  );

  const onSubmit = () => {
    // Intentionally not wired up yet.
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
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text
            className="text-left text-xl text-slate-700"
            fontStyle="noto-serif-bold"
          >
            Start a new feed
          </Text>
          <Text
            className="px-1 pb-6 pt-1 text-left"
            fontStyle="sf-display-light"
          >
            Pick who you’re shopping for, the occasion, and your budget.
          </Text>
        </View>

        <View className="gap-6">
            {/* Profile dropdown */}
            <View>
              <SectionLabel>Who is this for?</SectionLabel>
              <Pressable
                onPress={() => profileSheetRef.current?.present()}
                accessibilityRole="button"
                accessibilityLabel="Select a profile"
                className={`flex-row items-center justify-between rounded-xl border bg-white p-4 ${
                  selectedProfile ? "border-[#1f7a5c]" : "border-slate-300"
                }`}
              >
                <Text
                  className={
                    selectedProfile ? "text-slate-900" : "text-slate-400"
                  }
                  fontStyle="sf-rounded-medium"
                >
                  {selectedProfile?.name ?? "Select a profile"}
                </Text>
                <ChevronDown size={20} color="#64748b" />
              </Pressable>
            </View>

            {/* Occasion list */}
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
                      className={`rounded-full border px-4 py-2.5 ${
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-slate-300 bg-white"
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

            {/* Budget bucket */}
            <View>
              <SectionLabel>What’s your budget?</SectionLabel>
              <Pressable
                onPress={() => budgetSheetRef.current?.present()}
                accessibilityRole="button"
                accessibilityLabel="Select a budget"
                className={`flex-row items-center justify-between rounded-xl border bg-white p-4 ${
                  selectedBudget ? "border-[#1f7a5c]" : "border-slate-300"
                }`}
              >
                <Text
                  className={
                    selectedBudget ? "text-slate-900" : "text-slate-400"
                  }
                  fontStyle="sf-rounded-medium"
                >
                  {selectedBudget?.title ?? "Select a budget"}
                </Text>
                <ChevronDown size={20} color="#64748b" />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Pinned primary action. */}
        <View className="px-6 pb-2 pt-2">
          <CtaButton
            label="Start browsing"
            onPress={onSubmit}
            variant="dark"
            icon={<ArrowRight size={18} color="white" strokeWidth={2.5} />}
          />
        </View>

      <SelectSheet
        ref={profileSheetRef}
        heading="Choose a profile"
        subheading="Pick the person you’re shopping for."
        data={profileSelectItems}
        selectedId={selectedProfileId}
        onSelect={(item) => {
          setSelectedProfileId(item.id);
          profileSheetRef.current?.dismiss();
        }}
        ctaLabel="Add someone"
        ctaIcon={<Plus size={18} color="white" strokeWidth={2.5} />}
        ctaSlug="/feed/new"
      />

      <SelectSheet
        ref={budgetSheetRef}
        heading="What’s your budget?"
        subheading="Pick a range and we’ll match gift ideas to it."
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
