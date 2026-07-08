import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getApiClient } from "@/lib/api";
import { toBackendOccasion } from "@/lib/api/mappers";
import { addStoredProfileId } from "@/lib/state/profile-store";
import {
  getCurrentUserId,
  setCurrentProfile,
  setCurrentSession,
} from "@/lib/state/user-context";
import { HobbyChipPicker } from "@/components/feed-form/hobby-chip-picker";
import { LabeledFeedField } from "@/components/feed-form/labeled-feed-field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { TextField } from "@/components/ui/text-field";
import {
  formatOccasionLabel,
  OCCASION_OPTIONS,
  parseOptionalNumber,
} from "@/lib/feed-form-shared";
import { useToast } from "@/components/ui/toast";

export default function NewFeedScreen() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === "1";
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [hobbyIds, setHobbyIds] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();

  const onSubmit = async () => {
    const userId = getCurrentUserId();
    const trimmedName = name.trim();
    if (!userId) {
      setError("Setup isn’t finished yet. Go back and try again in a moment.");
      return;
    }
    if (!trimmedName) {
      setError("Add a name so you know whose list this is.");
      return;
    }
    if (hobbyIds.length === 0) {
      setError("Pick at least one interest.");
      return;
    }

    const parsedMin = parseOptionalNumber(budgetMin) ?? 25;
    const parsedMax = parseOptionalNumber(budgetMax) ?? 100;
    if (parsedMax <= parsedMin) {
      setError("Budget max must be greater than budget min.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const backendOccasion = toBackendOccasion(occasion);
      const created = await api.createProfile({
        label: trimmedName,
        hobby_ids: hobbyIds,
        budget_min: parsedMin,
        budget_max: parsedMax,
        occasion: backendOccasion,
      });

      await addStoredProfileId(userId, created.id);
      setCurrentProfile(created.id);

      const session = await api.createSession(created.id);
      setCurrentSession(session.id);

      toast.show({ message: `${trimmedName}’s list is ready`, variant: "success" });
      router.replace({
        pathname: "/",
        params: {
          refreshKey: String(Date.now()),
          selectedFeedId: created.id,
        },
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Couldn’t create the list. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: isOnboarding ? "Welcome" : "Add someone",
          headerBackVisible: !isOnboarding,
          gestureEnabled: !isOnboarding,
          headerShadowVisible: false,
        }}
      />
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
              {isOnboarding
                ? "Let’s set up your first list"
                : "Who are you shopping for?"}
            </Text>
            <Text className="text-[15px] leading-relaxed text-zinc-500">
              {isOnboarding
                ? "Add the first person you’re shopping for and we’ll start finding gifts they’ll love."
                : "Tell us a little about them and we’ll tailor gift ideas to their taste."}
            </Text>
          </View>

          <TextField
            label="Their name"
            hint="Shows at the top of your feed — for example “Mom” or “Jamie”."
            value={name}
            onChangeText={setName}
            placeholder="e.g. Mom, Jamie"
          />

          <LabeledFeedField
            label="Occasion"
            hint="Optional — we’ll prioritize ideas that fit."
          >
            <View className="flex-row flex-wrap gap-2">
              {OCCASION_OPTIONS.map((option) => {
                const isSelected = occasion === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setOccasion(isSelected ? "" : option)}
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
                      {formatOccasionLabel(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </LabeledFeedField>

          <LabeledFeedField
            label="Interests"
            hint="Pick a few hobbies or interests to tailor gift ideas."
          >
            <HobbyChipPicker selectedIds={hobbyIds} onChange={setHobbyIds} />
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
            label={isOnboarding ? "Start finding gifts" : "Create list"}
            onPress={onSubmit}
            loading={submitting}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
