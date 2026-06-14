import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createGiftGeniusApiClient, type FeedDto } from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import { ensureHobbyCatalog, matchHobbyIds } from "@/lib/api/hobbies";
import { profileToFeedDto } from "@/lib/api/mappers";
import { LabeledFeedField } from "@/components/feed-form/labeled-feed-field";
import { ReadOnlyInterestChip } from "@/components/feed-form/read-only-interest-chip";
import { mergeInterestLists } from "@/lib/feed-form-shared";
import {
  getAccessToken,
  getCurrentFeedId,
} from "@/lib/state/user-context";

function parseBudgetOrNull(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : "invalid";
}

export default function FeedSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [savedInterests, setSavedInterests] = useState<string[]>([]);
  const [newInterestsText, setNewInterestsText] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedSnapshot, setFeedSnapshot] = useState<FeedDto | null>(null);
  const [knownHobbyIds, setKnownHobbyIds] = useState<string[]>([]);

  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

  const loadFeed = useCallback(async () => {
    const profileId = getCurrentFeedId();
    if (!profileId) {
      setError("Missing profile. Open the feed from the home screen first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const detail = await api.getProfile(profileId);
      const feed = profileToFeedDto(detail);
      setFeedSnapshot(feed);
      setKnownHobbyIds(detail.hobby_ids);
      setName(feed.name);
      setSavedInterests(feed.interests?.length ? [...feed.interests] : []);
      setNewInterestsText("");
      setBudgetMin(feed.budgetMin != null ? String(feed.budgetMin) : "");
      setBudgetMax(feed.budgetMax != null ? String(feed.budgetMax) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile.");
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
      setError("Name is required.");
      return;
    }

    const minParsed = parseBudgetOrNull(budgetMin);
    const maxParsed = parseBudgetOrNull(budgetMax);
    if (minParsed === "invalid" || maxParsed === "invalid") {
      setError("Budget values must be valid numbers.");
      return;
    }
    if (minParsed != null && maxParsed != null && minParsed > maxParsed) {
      setError("Budget min cannot be greater than budget max.");
      return;
    }

    const combinedInterestNames = mergeInterestLists(savedInterests, newInterestsText);

    setSubmitting(true);
    setError(null);
    try {
      let hobbyIds = knownHobbyIds;
      if (newInterestsText.trim()) {
        const hobbies = await ensureHobbyCatalog(api);
        const addedIds = matchHobbyIds(combinedInterestNames, hobbies);
        if (addedIds.length > 0) {
          hobbyIds = addedIds;
        }
      }

      await api.updateProfile(profileId, {
        label: trimmedName,
        hobby_ids: hobbyIds.length > 0 ? hobbyIds : undefined,
        budget_min: minParsed ?? undefined,
        budget_max: maxParsed ?? undefined,
      });
      router.back();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to update profile."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
        <Text className="mt-3 text-zinc-600">Loading profile…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-3 p-4 pb-4"
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-xl font-noto-serif-bold">Profile settings</Text>
            <Text className="text-sm text-zinc-600">
              Update label, interests, and budget for this recipient profile.
            </Text>

            <LabeledFeedField
              label="Profile label"
              hint="Shows at the top of the swipe screen—for example who gifts are for."
            >
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Mom, Jamie"
                accessibilityLabel="Profile label"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </LabeledFeedField>
            <View className="gap-2">
              <Text className="text-sm font-medium text-zinc-900">Saved interests</Text>
              <Text className="-mt-0.5 text-xs leading-snug text-zinc-500">
                Hobbies linked to this profile. Add more below to append matching catalog hobbies.
              </Text>
              {savedInterests.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {savedInterests.map((tag, index) => (
                    <ReadOnlyInterestChip key={`${tag}-${index}`} label={tag} />
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-zinc-500">No interests on this profile yet.</Text>
              )}
            </View>
            <LabeledFeedField
              label="Add interests"
              hint="Comma-separated hobbies to match against the catalog on save."
            >
              <TextInput
                value={newInterestsText}
                onChangeText={setNewInterestsText}
                placeholder="e.g. hiking, fiction, espresso"
                accessibilityLabel="Additional interests to add"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </LabeledFeedField>
            <LabeledFeedField
              label="Budget minimum"
              hint="Whole dollars in your usual currency."
            >
              <TextInput
                value={budgetMin}
                onChangeText={setBudgetMin}
                placeholder="Optional"
                keyboardType="numeric"
                accessibilityLabel="Budget minimum in dollars"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </LabeledFeedField>
            <LabeledFeedField
              label="Budget maximum"
              hint="Upper price cap for this profile."
            >
              <TextInput
                value={budgetMax}
                onChangeText={setBudgetMax}
                placeholder="Optional"
                keyboardType="numeric"
                accessibilityLabel="Budget maximum in dollars"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </LabeledFeedField>

            {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
          </ScrollView>

          <View className="border-t border-zinc-200 bg-white px-4 pt-3 pb-2">
            <Pressable
              onPress={onSave}
              disabled={submitting || !feedSnapshot}
              className="rounded-md bg-black px-4 py-3.5"
              style={{ opacity: submitting || !feedSnapshot ? 0.6 : 1 }}
            >
              <Text className="text-center text-base font-medium text-white">
                {submitting ? "Saving…" : "Save changes"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
