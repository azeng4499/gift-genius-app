import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, Text, TextInput, View } from "react-native";

import { createGiftGeniusApiClient } from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import {
  getAccessToken,
  getCurrentUserId,
  setCurrentFeed,
} from "@/lib/state/user-context";

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const RELATIONSHIP_OPTIONS = [
  "mom",
  "dad",
  "partner",
  "spouse",
  "friend",
  "sibling",
  "grandparent",
  "coworker",
  "child",
  "other",
];

export default function NewFeedScreen() {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [interests, setInterests] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getUserId: () => getCurrentUserId(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

  const onSubmit = async () => {
    const userId = getCurrentUserId();
    const trimmedName = name.trim();
    if (!userId) {
      setError("No active user. Go back and run bootstrap first.");
      return;
    }
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    const parsedInterests = interests
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createFeed({
        userId,
        name: trimmedName,
        relationship: relationship.trim() || undefined,
        interests: parsedInterests.length > 0 ? parsedInterests : undefined,
        budgetMin: parseOptionalNumber(budgetMin),
        budgetMax: parseOptionalNumber(budgetMax),
      });
      setCurrentFeed(created.id);
      router.replace({
        pathname: "/",
        params: {
          refreshKey: String(Date.now()),
          selectedFeedId: String(created.id),
        },
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to create feed.";
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
          Fill out the person details. This creates a new feed for your active user.
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name (required)"
          className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
        />
        <View>
          <Pressable
            className="rounded-md border border-zinc-300 px-3 py-2"
            onPress={() => setRelationshipOpen((prev) => !prev)}
          >
            <Text className={relationship ? "text-zinc-900" : "text-zinc-400"}>
              {relationship || "Relationship (optional)"}
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
        <TextInput
          value={interests}
          onChangeText={setInterests}
          placeholder="Interests comma-separated (optional)"
          className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
        />
        <TextInput
          value={budgetMin}
          onChangeText={setBudgetMin}
          placeholder="Budget min (optional)"
          keyboardType="numeric"
          className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
        />
        <TextInput
          value={budgetMax}
          onChangeText={setBudgetMax}
          placeholder="Budget max (optional)"
          keyboardType="numeric"
          className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
        />

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className="rounded-md bg-black px-4 py-3"
          style={{ opacity: submitting ? 0.6 : 1 }}
        >
          <Text className="text-center text-white">
            {submitting ? "Creating..." : "Create feed"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
