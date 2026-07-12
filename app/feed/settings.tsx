import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type FeedDto } from "@/lib/api/client";
import { getApiClient } from "@/lib/api";
import { profileToFeedDto } from "@/lib/api/mappers";
import { HobbyChipPicker } from "@/components/feed-form/hobby-chip-picker";
import { LabeledFeedField } from "@/components/feed-form/labeled-feed-field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { TextField } from "@/components/ui/text-field";
import {
  formatRelationshipLabel,
  RELATIONSHIP_OPTIONS,
} from "@/lib/feed-form-shared";
import { getCurrentFeedId } from "@/lib/state/user-context";
import { useToast } from "@/components/ui/toast";

function parseBudgetOrNull(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : "invalid";
}

export default function FeedSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [initialRelationship, setInitialRelationship] = useState("");
  const [hobbyIds, setHobbyIds] = useState<string[]>([]);
  const [initialHobbyIds, setInitialHobbyIds] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [interestsError, setInterestsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedSnapshot, setFeedSnapshot] = useState<FeedDto | null>(null);
  const hobbyNamesRef = useRef<Map<string, string>>(new Map());

  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();

  const onHobbyIdsChange = useCallback((ids: string[]) => {
    setHobbyIds(ids);
    if (ids.length > 0) setInterestsError(null);
  }, []);

  const loadFeed = useCallback(async () => {
    const profileId = getCurrentFeedId();
    if (!profileId) {
      setError("Open a list from the home screen first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setInterestsError(null);
    try {
      const detail = await api.getProfile(profileId);
      const feed = profileToFeedDto(detail);
      setFeedSnapshot(feed);
      setHobbyIds(detail.hobby_ids);
      setInitialHobbyIds(detail.hobby_ids);
      hobbyNamesRef.current = new Map(
        (detail.hobbies ?? []).map((h) => [h.id, h.name])
      );
      setName(feed.name);
      const rel = detail.relationship ?? "";
      setRelationship(rel);
      setInitialRelationship(rel);
      setBudgetMin(feed.budgetMin != null ? String(feed.budgetMin) : "");
      setBudgetMax(feed.budgetMax != null ? String(feed.budgetMax) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this list.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onSave = async () => {
    const profileId = getCurrentFeedId();
    const trimmedName = name.trim();
    if (!profileId || !feedSnapshot) {
      setError("Nothing to save. Reload this screen.");
      return;
    }
    if (!trimmedName) {
      setError("Add a name so you know whose list this is.");
      return;
    }

    const minParsed = parseBudgetOrNull(budgetMin);
    const maxParsed = parseBudgetOrNull(budgetMax);
    if (minParsed === "invalid" || maxParsed === "invalid") {
      setError("Budget values must be numbers.");
      return;
    }
    if (minParsed != null && maxParsed != null && minParsed > maxParsed) {
      setError("Min budget can't be more than max budget.");
      return;
    }
    if (hobbyIds.length === 0) {
      setInterestsError(
        "Keep at least one interest so we know what gifts to recommend."
      );
      setError(null);
      return;
    }

    const removedIds = initialHobbyIds.filter((id) => !hobbyIds.includes(id));
    const interestsChanged =
      removedIds.length > 0 ||
      hobbyIds.some((id) => !initialHobbyIds.includes(id));
    const relationshipChanged = relationship !== initialRelationship;
    const shouldRefreshFeed = interestsChanged || relationshipChanged;

    setSubmitting(true);
    setError(null);
    setInterestsError(null);
    try {
      await api.updateProfile(profileId, {
        label: trimmedName,
        hobby_ids: hobbyIds,
        budget_min: minParsed ?? undefined,
        budget_max: maxParsed ?? undefined,
        relationship: relationship || null,
      });

      if (removedIds.length === 1) {
        const label = hobbyNamesRef.current.get(removedIds[0]) ?? "Interest";
        toast.show({
          message: `${label} removed — showing other interests instead`,
          variant: "success",
        });
      } else if (removedIds.length > 1) {
        toast.show({
          message: `${removedIds.length} interests removed from this list`,
          variant: "success",
        });
      } else {
        toast.show({ message: "Changes saved", variant: "success" });
      }

      if (shouldRefreshFeed) {
        router.replace({
          pathname: "/",
          params: { refreshFeedKey: String(Date.now()) },
        });
      } else {
        router.back();
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Couldn't save changes. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1f7a5c" />
        <Text className="mt-3 text-zinc-500">Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <Stack.Screen options={{ title: "Edit list", headerShadowVisible: false }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          contentContainerClassName="gap-6 px-5 pt-3 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-2">
            <Text className="font-noto-serif-bold text-[26px] leading-tight text-zinc-900">
              Edit this person
            </Text>
            <Text className="text-[15px] leading-relaxed text-zinc-500">
              Update their name, relationship, interests, and budget to fine-tune gift ideas.
            </Text>
          </View>

          <TextField
            label="Their name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Mom, Jamie"
          />

          <LabeledFeedField
            label="Relationship"
            hint="Optional — slight nudge only. Interests still drive most recommendations."
          >
            <View className="flex-row flex-wrap gap-2">
              {RELATIONSHIP_OPTIONS.map((option) => {
                const isSelected = relationship === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setRelationship(isSelected ? "" : option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    className={`rounded-full border px-4 py-2 ${
                      isSelected
                        ? "border-[#1f7a5c] bg-[#1f7a5c]"
                        : "border-zinc-300 bg-white"
                    }`}
                  >
                    <Text
                      className={`font-sf-display-medium text-sm ${
                        isSelected ? "text-white" : "text-zinc-700"
                      }`}
                    >
                      {formatRelationshipLabel(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </LabeledFeedField>

          <LabeledFeedField
            label="Interests"
            hint="Tap X to remove an interest from this feed. You can add it back anytime."
          >
            <HobbyChipPicker
              selectedIds={hobbyIds}
              onChange={onHobbyIdsChange}
              confirmOnRemove
            />
            {interestsError ? (
              <Text className="mt-1 text-sm text-red-600">{interestsError}</Text>
            ) : null}
          </LabeledFeedField>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label="Min budget"
                value={budgetMin}
                onChangeText={setBudgetMin}
                placeholder="$25"
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Max budget"
                value={budgetMax}
                onChangeText={setBudgetMax}
                placeholder="$100"
                keyboardType="numeric"
              />
            </View>
          </View>

          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        </ScrollView>

        <View className="border-t border-zinc-100 bg-white px-5 pt-3 pb-2">
          <PrimaryButton
            label="Save changes"
            onPress={onSave}
            loading={submitting}
            disabled={!feedSnapshot}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
