import { Stack } from "expo-router";
import { Check, ChevronDown } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthInput } from "@/components/ui/auth-input";
import { CtaButton } from "@/components/ui/cta-button";
import { Text } from "@/components/ui/text";
import { getApiClient } from "@/lib/api";
import { loadProfilesForUser } from "@/lib/api/bootstrap";
import type { FeedDto } from "@/lib/api/client";
import { formatOccasionLabel, OCCASION_OPTIONS } from "@/lib/feed-form-shared";
import { getCurrentUserId } from "@/lib/state/user-context";

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
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const onSubmit = () => {
    // Intentionally not wired up yet.
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <Stack.Screen
        options={{ title: "Start a feed", headerShadowVisible: false }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pt-2 pb-8"
          keyboardShouldPersistTaps="handled"
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
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Select a profile"
                className="flex-row items-center justify-between rounded-xl border border-slate-300 bg-white p-4"
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

            {/* Budget */}
            <View>
              <SectionLabel>What’s your budget?</SectionLabel>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <AuthInput
                    placeholder="Min $"
                    keyboardType="numeric"
                    value={budgetMin}
                    onChangeText={setBudgetMin}
                    returnKeyType="next"
                  />
                </View>
                <View className="flex-1">
                  <AuthInput
                    placeholder="Max $"
                    keyboardType="numeric"
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>

            <CtaButton
              label="Start browsing"
              onPress={onSubmit}
              className="mt-4"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Profile picker */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setPickerOpen(false)}
        >
          <Pressable
            className="rounded-t-2xl bg-white px-6 pb-8 pt-3"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-3 items-center">
              <View className="h-1 w-10 rounded-full bg-zinc-300" />
            </View>
            <Text
              className="text-left text-xl text-slate-700"
              fontStyle="noto-serif-bold"
            >
              Choose a profile
            </Text>
            <Text
              className="px-1 pb-4 pt-1 text-left"
              fontStyle="sf-display-light"
            >
              Whose gift feed do you want to open?
            </Text>

            {profiles.length === 0 ? (
              <Text className="px-1 py-4 text-slate-400" fontStyle="sf-display-light">
                No profiles yet. Add someone first.
              </Text>
            ) : (
              <View className="gap-2.5">
                {profiles.map((profile) => {
                  const isSelected = profile.id === selectedProfileId;
                  return (
                    <Pressable
                      key={profile.id}
                      onPress={() => {
                        setSelectedProfileId(profile.id);
                        setPickerOpen(false);
                      }}
                      className="flex-row items-center justify-between rounded-2xl border px-4 py-3.5"
                      style={{
                        borderColor: isSelected ? "#1f7a5c" : "#e2e8f0",
                        backgroundColor: isSelected
                          ? "rgba(31,122,92,0.06)"
                          : "white",
                      }}
                    >
                      <Text
                        className="text-base text-slate-900"
                        fontStyle="sf-display-semibold"
                      >
                        {profile.name}
                      </Text>
                      {isSelected ? (
                        <View
                          className="h-6 w-6 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#1f7a5c" }}
                        >
                          <Check size={14} color="white" strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
