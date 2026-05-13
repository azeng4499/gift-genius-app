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
import { LabeledFeedField } from "@/components/feed-form/labeled-feed-field";
import { ReadOnlyInterestChip } from "@/components/feed-form/read-only-interest-chip";
import { RELATIONSHIP_OPTIONS, mergeInterestLists } from "@/lib/feed-form-shared";
import {
  getAccessToken,
  getCurrentFeedId,
  getCurrentUserId,
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
  const [relationship, setRelationship] = useState("");
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  /** Loaded from API; shown read-only—not removable in this UI. */
  const [savedInterests, setSavedInterests] = useState<string[]>([]);
  /** Comma-separated interests to append on save. */
  const [newInterestsText, setNewInterestsText] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedSnapshot, setFeedSnapshot] = useState<FeedDto | null>(null);

  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getUserId: () => getCurrentUserId(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

  const loadFeed = useCallback(async () => {
    const userId = getCurrentUserId();
    const feedId = getCurrentFeedId();
    if (!userId || !feedId) {
      setError("Missing user or feed. Open the feed from the home screen first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const feeds = await api.getFeeds(userId);
      const feed = feeds.find((f) => f.id === feedId) ?? null;
      if (!feed) {
        setError("Could not load this feed. Try switching feeds from the menu.");
        setFeedSnapshot(null);
        setSavedInterests([]);
        setNewInterestsText("");
        return;
      }
      setFeedSnapshot(feed);
      setName(feed.name);
      setRelationship(feed.relationship ?? "");
      setSavedInterests(feed.interests?.length ? [...feed.interests] : []);
      setNewInterestsText("");
      setBudgetMin(feed.budgetMin != null ? String(feed.budgetMin) : "");
      setBudgetMax(feed.budgetMax != null ? String(feed.budgetMax) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feed.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onSave = async () => {
    const feedId = getCurrentFeedId();
    const trimmedName = name.trim();
    if (!feedId || !feedSnapshot) {
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

    const combinedInterests = mergeInterestLists(savedInterests, newInterestsText);

    setSubmitting(true);
    setError(null);
    try {
      await api.updateFeed(feedId, {
        name: trimmedName,
        relationship: relationship.trim() || null,
        interests: combinedInterests,
        budgetMin: minParsed,
        budgetMax: maxParsed,
      });
      router.back();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to update feed. If this persists, the API may not support PATCH /feeds yet."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
        <Text className="mt-3 text-zinc-600">Loading feed…</Text>
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
            <Text className="text-xl font-noto-serif-bold">Feed settings</Text>
            <Text className="text-sm text-zinc-600">
              Update who this feed is for, interests, and budget. Saving returns you to swipes.
            </Text>

            <LabeledFeedField
              label="Feed title"
              hint="Shows at the top of the swipe screen—for example who gifts are for."
            >
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Mom, Jamie"
                accessibilityLabel="Feed title"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </LabeledFeedField>
            <LabeledFeedField
              label="Relationship"
              hint="Helps tailor wording and tone for searches behind your swipe picks."
            >
              <View>
                <Pressable
                  className="rounded-md border border-zinc-300 px-3 py-2"
                  accessibilityHint={relationshipOpen ? undefined : "Opens choices"}
                  accessibilityRole="button"
                  accessibilityLabel="Relationship"
                  onPress={() => setRelationshipOpen((prev) => !prev)}
                >
                  <Text className={relationship ? "text-zinc-900" : "text-zinc-400"}>
                    {relationship || "Tap to choose (optional)"}
                  </Text>
                </Pressable>
                {relationshipOpen ? (
                  <View className="mt-2 rounded-md border border-zinc-300 bg-white">
                    {RELATIONSHIP_OPTIONS.map((option) => {
                      const isSelected = relationship === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => {
                            setRelationship(option);
                            setRelationshipOpen(false);
                          }}
                          className="px-3 py-2"
                          style={{
                            backgroundColor: isSelected ? "rgba(31,122,92,0.08)" : "white",
                          }}
                        >
                          <Text className="text-zinc-900">{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </LabeledFeedField>
            <View className="gap-2">
              <Text className="text-sm font-medium text-zinc-900">Saved interests</Text>
              <Text className="-mt-0.5 text-xs leading-snug text-zinc-500">
                Already on this feed—we use these for matching. You cannot remove them here; use Add
                interests to append more.
              </Text>
              {savedInterests.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {savedInterests.map((tag, index) => (
                    <ReadOnlyInterestChip key={`${tag}-${index}`} label={tag} />
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-zinc-500">No interests on this feed yet.</Text>
              )}
            </View>
            <LabeledFeedField
              label="Add interests"
              hint="Comma-separated hobbies or topics to add on top of saved ones; duplicates are skipped."
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
              hint="Whole dollars in your usual currency. Items below this are filtered out."
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
              hint="Upper price cap for this feed."
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
