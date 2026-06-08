import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, Text, TextInput, View } from "react-native";

import { createGiftGeniusApiClient } from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import { toBackendOccasion } from "@/lib/api/mappers";
import {
  addStoredProfileId,
} from "@/lib/state/profile-store";
import {
  getAccessToken,
  getCurrentUserId,
  setCurrentProfile,
} from "@/lib/state/user-context";
import { LabeledFeedField } from "@/components/feed-form/labeled-feed-field";
import { OCCASION_OPTIONS, parseOptionalNumber } from "@/lib/feed-form-shared";

function matchHobbyIds(
  interestTokens: string[],
  hobbies: { id: string; name: string; slug: string }[]
): string[] {
  const matched: string[] = [];
  for (const token of interestTokens) {
    const key = token.toLowerCase();
    const hit =
      hobbies.find((h) => h.name.toLowerCase() === key) ??
      hobbies.find((h) => h.slug.toLowerCase() === key) ??
      hobbies.find((h) => h.name.toLowerCase().includes(key));
    if (hit && !matched.includes(hit.id)) {
      matched.push(hit.id);
    }
  }
  return matched;
}

export default function NewFeedScreen() {
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [occasionOpen, setOccasionOpen] = useState(false);
  const [interests, setInterests] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

  const onSubmit = async () => {
    const userId = getCurrentUserId();
    const trimmedName = name.trim();
    if (!userId) {
      setError("No active user. Go back to the home screen first.");
      return;
    }
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    const parsedMin = parseOptionalNumber(budgetMin) ?? 25;
    const parsedMax = parseOptionalNumber(budgetMax) ?? 100;
    if (parsedMax <= parsedMin) {
      setError("Budget max must be greater than budget min.");
      return;
    }

    const interestTokens = interests
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    setSubmitting(true);
    setError(null);
    try {
      const hobbies = await api.listHobbies();
      let hobbyIds = matchHobbyIds(interestTokens, hobbies);
      if (hobbyIds.length === 0 && hobbies.length > 0) {
        hobbyIds = [hobbies[0].id];
      }
      if (hobbyIds.length === 0) {
        throw new Error("No hobbies available. Ask an admin to seed the catalog.");
      }

      const created = await api.createProfile({
        label: trimmedName,
        hobby_ids: hobbyIds,
        budget_min: parsedMin,
        budget_max: parsedMax,
      });

      await addStoredProfileId(userId, created.id);
      setCurrentProfile(created.id);

      const backendOccasion = toBackendOccasion(occasion);
      await api.createSession(created.id, backendOccasion);

      router.replace({
        pathname: "/",
        params: {
          refreshKey: String(Date.now()),
          selectedFeedId: created.id,
        },
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to create profile.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 p-4">
        <Text className="text-xl font-noto-serif-bold">Add New Feed Person</Text>
        <Text className="text-sm text-zinc-600">
          Creates a recipient profile (POST /profiles) and starts a feed session.
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
        <LabeledFeedField
          label="Occasion"
          hint="Used when starting the feed session for this profile."
        >
          <View>
            <Pressable
              className="rounded-md border border-zinc-300 px-3 py-2"
              accessibilityHint={occasionOpen ? undefined : "Opens choices"}
              accessibilityRole="button"
              accessibilityLabel="Occasion"
              onPress={() => setOccasionOpen((prev) => !prev)}
            >
              <Text className={occasion ? "text-zinc-900" : "text-zinc-400"}>
                {occasion
                  ? occasion.replace(/_/g, " ")
                  : "Tap to choose (optional)"}
              </Text>
            </Pressable>
            {occasionOpen ? (
              <View className="mt-2 rounded-md border border-zinc-300 bg-white">
                {OCCASION_OPTIONS.map((option) => {
                  const isSelected = occasion === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setOccasion(option);
                        setOccasionOpen(false);
                      }}
                      className="px-3 py-2"
                      style={{
                        backgroundColor: isSelected ? "rgba(31,122,92,0.08)" : "white",
                      }}
                    >
                      <Text className="text-zinc-900">{option.replace(/_/g, " ")}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </LabeledFeedField>
        <LabeledFeedField
          label="Interests"
          hint="Comma-separated hobbies—we match them to catalog hobby names when possible."
        >
          <TextInput
            value={interests}
            onChangeText={setInterests}
            placeholder="e.g. hiking, fiction, espresso"
            accessibilityLabel="Interests"
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </LabeledFeedField>
        <LabeledFeedField
          label="Budget minimum"
          hint="Whole dollars. Defaults to 25 if left blank."
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
          hint="Upper price cap. Defaults to 100 if left blank."
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

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className="rounded-md bg-black px-4 py-3"
          style={{ opacity: submitting ? 0.6 : 1 }}
        >
          <Text className="text-center text-white">
            {submitting ? "Creating..." : "Create profile"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
