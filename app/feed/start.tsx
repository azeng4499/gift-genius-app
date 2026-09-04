import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useMemo } from "react";

import { FeedForm, type FeedFormValues } from "@/components/feed-form/feed-form";
import { useToast } from "@/components/ui/toast";
import { getApiClient } from "@/lib/api";
import { toBackendOccasion } from "@/lib/api/mappers";
import { addStoredProfileId } from "@/lib/state/profile-store";
import {
  getCurrentUserId,
  setCurrentProfile,
  setCurrentSession,
} from "@/lib/state/user-context";

export default function StartFeedScreen() {
  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();

  const onSubmit = async (values: FeedFormValues) => {
    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error(
        "Setup isn’t finished yet. Go back and try again in a moment.",
      );
    }

    const created = await api.createProfile({
      label: values.name,
      hobby_ids: values.hobbyIds,
      budget_min: values.budget.min,
      budget_max: values.budget.max,
      occasion: values.occasion ? toBackendOccasion(values.occasion) : undefined,
      relationship: values.relationship,
    });

    await addStoredProfileId(userId, created.id);
    setCurrentProfile(created.id);

    const session = await api.createSession(created.id);
    setCurrentSession(session.id);

    toast.show({
      message: `${values.name}’s feed is ready`,
      variant: "success",
    });
    router.replace({
      pathname: "/",
      params: {
        refreshKey: String(Date.now()),
        selectedFeedId: created.id,
      },
    });
  };

  return (
    <FeedForm
      title="Start a new feed"
      subheading="Tell us who you’re shopping for and what they're into."
      ctaLabel="Start browsing"
      ctaVariant="dark"
      ctaIcon={<ArrowRight size={18} color="white" strokeWidth={2.5} />}
      onSubmit={onSubmit}
    />
  );
}
