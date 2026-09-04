import { router, Stack } from "expo-router";
import { Save } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  budgetBucketIdForRange,
  FeedForm,
  type FeedFormInitialValues,
  type FeedFormValues,
} from "@/components/feed-form/feed-form";
import { useToast } from "@/components/ui/toast";
import { getApiClient } from "@/lib/api";
import { fromBackendOccasion, toBackendOccasion } from "@/lib/api/mappers";
import { getCurrentFeedId } from "@/lib/state/user-context";

export default function EditFeedScreen() {
  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialValues, setInitialValues] =
    useState<FeedFormInitialValues | null>(null);
  // Baseline for deciding whether a save should force a feed refresh.
  const baseline = useRef<{
    hobbyIds: string[];
    relationship: string;
    occasion: string;
  }>({ hobbyIds: [], relationship: "", occasion: "" });

  const loadFeed = useCallback(async () => {
    const profileId = getCurrentFeedId();
    if (!profileId) {
      setLoadError("Open a feed from the home screen first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const detail = await api.getProfile(profileId);
      const relationship = detail.relationship ?? "";
      const occasion = fromBackendOccasion(detail.occasion);
      baseline.current = {
        hobbyIds: detail.hobby_ids,
        relationship,
        occasion,
      };
      setInitialValues({
        name: detail.label,
        relationship,
        hobbyIds: detail.hobby_ids,
        occasion,
        budgetBucketId: budgetBucketIdForRange(
          detail.budget_min,
          detail.budget_max,
        ),
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn’t load this feed.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onSubmit = async (values: FeedFormValues) => {
    const profileId = getCurrentFeedId();
    if (!profileId) {
      throw new Error("Nothing to save. Reload this screen.");
    }

    const nextOccasion = toBackendOccasion(values.occasion);
    await api.updateProfile(profileId, {
      label: values.name,
      hobby_ids: values.hobbyIds,
      budget_min: values.budget.min,
      budget_max: values.budget.max,
      relationship: values.relationship || null,
      occasion: nextOccasion,
    });

    // A changed name/budget doesn't alter recommendations, but interests,
    // relationship, and occasion do — refresh the feed only when they move.
    const base = baseline.current;
    const interestsChanged =
      base.hobbyIds.length !== values.hobbyIds.length ||
      base.hobbyIds.some((id) => !values.hobbyIds.includes(id)) ||
      values.hobbyIds.some((id) => !base.hobbyIds.includes(id));
    const relationshipChanged = values.relationship !== base.relationship;
    const occasionChanged =
      nextOccasion !== toBackendOccasion(base.occasion || "just_because");

    toast.show({ message: "Changes saved", variant: "success" });

    if (interestsChanged || relationshipChanged || occasionChanged) {
      router.replace({
        pathname: "/",
        params: { refreshFeedKey: String(Date.now()) },
      });
    } else {
      router.back();
    }
  };

  if (loading || (loadError && !initialValues)) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ headerShown: false }} />
        {loading ? (
          <>
            <ActivityIndicator size="large" color="#1f7a5c" />
            <Text className="mt-3 text-zinc-500">Loading…</Text>
          </>
        ) : (
          <Text className="px-8 text-center text-red-500">{loadError}</Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <FeedForm
      title="Edit feed"
      subheading="Update profile info."
      ctaLabel="Save"
      ctaVariant="dark"
      ctaIcon={<Save size={18} color="white" strokeWidth={2.5} />}
      initialValues={initialValues ?? undefined}
      onSubmit={onSubmit}
    />
  );
}
