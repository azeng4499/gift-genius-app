import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { Check, ChevronRight, Plus, Settings2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/ui/toast";
import { getApiClient } from "@/lib/api";
import {
  loadProfilesForUser,
  startSessionForProfile,
} from "@/lib/api/bootstrap";
import type { FeedDto } from "@/lib/api/client";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { getCurrentFeedId, getCurrentUserId } from "@/lib/state/user-context";

function formatBudget(feed: FeedDto): string | null {
  const { budgetMin, budgetMax } = feed;
  if (budgetMin == null && budgetMax == null) return null;
  const money = (value: number) => `$${value}`;
  if (budgetMin != null && budgetMax != null) {
    return `${money(budgetMin)} – ${money(budgetMax)}`;
  }
  return money((budgetMin ?? budgetMax) as number);
}

function feedSubtitle(feed: FeedDto): string {
  const parts = [feed.relationship, feed.occasion, formatBudget(feed)].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" • ") : "Tap to shop for this person";
}

export default function PeopleScreen() {
  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();

  const [feeds, setFeeds] = useState<FeedDto[]>([]);
  const [activeFeedId, setActiveFeedId] = useState<string | null>(() =>
    getCurrentFeedId(),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFeeds = useCallback(
    async (isRefresh = false) => {
      const userId = getCurrentUserId();
      if (!userId) {
        setFeeds([]);
        setError("Sign in to manage your people and feeds.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const profiles = await loadProfilesForUser(api, userId);
        setFeeds(profiles);
        setActiveFeedId(getCurrentFeedId());
      } catch (err) {
        setError(friendlyErrorMessage(err, "Couldn't load your people."));
        setFeeds([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api],
  );

  useFocusEffect(
    useCallback(() => {
      loadFeeds();
    }, [loadFeeds]),
  );

  const switchToFeed = useCallback(
    async (feed: FeedDto) => {
      if (feed.id === activeFeedId || switchingId) return;
      setSwitchingId(feed.id);
      try {
        await startSessionForProfile(api, feed.id);
        setActiveFeedId(feed.id);
        toast.show({ message: `Now shopping for ${feed.name}`, variant: "success" });
      } catch (err) {
        toast.show({ message: friendlyErrorMessage(err), variant: "error" });
      } finally {
        setSwitchingId(null);
      }
    },
    [activeFeedId, api, switchingId, toast],
  );

  const manageFeed = useCallback(
    async (feed: FeedDto) => {
      // Feed settings edits the active feed, so switch to it first.
      if (feed.id !== activeFeedId) {
        try {
          await startSessionForProfile(api, feed.id);
          setActiveFeedId(feed.id);
        } catch (err) {
          toast.show({ message: friendlyErrorMessage(err), variant: "error" });
          return;
        }
      }
      router.push("/feed/settings");
    },
    [activeFeedId, api, toast],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-4 pb-3 pt-2">
        <Text className="text-xl font-noto-serif-bold text-zinc-900">
          People & feeds
        </Text>
        <Text className="mt-1 text-sm text-zinc-600">
          Switch who you’re shopping for, or edit their interests and budget.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
          <Text className="mt-3 text-zinc-500">Loading people…</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFeeds(true)}
            />
          }
        >
          {error ? (
            <View className="rounded-xl border border-red-200 bg-red-50 p-4">
              <Text className="text-sm text-red-800">{error}</Text>
              <Pressable onPress={() => loadFeeds()} className="mt-3 self-start">
                <Text className="text-sm font-medium text-red-900">Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {!error && feeds.length === 0 ? (
            <View className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <Text className="text-sm font-medium text-zinc-900">
                No people yet
              </Text>
              <Text className="mt-2 text-sm text-zinc-600">
                Add someone you’re shopping for to start building their feed.
              </Text>
            </View>
          ) : null}

          <View className="gap-2.5">
            {feeds.map((feed) => {
              const isActive = feed.id === activeFeedId;
              const isSwitching = switchingId === feed.id;
              return (
                <Pressable
                  key={feed.id}
                  disabled={isSwitching}
                  onPress={() => switchToFeed(feed)}
                  className="flex-row items-center justify-between rounded-2xl border px-4 py-3.5"
                  style={{
                    borderColor: isActive ? "#1f7a5c" : "#e4e4e7",
                    backgroundColor: isActive ? "rgba(31,122,92,0.06)" : "white",
                  }}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-sf-display-semibold text-zinc-900">
                      {feed.name}
                    </Text>
                    <Text
                      className="mt-0.5 text-[13px] text-zinc-500"
                      numberOfLines={1}
                    >
                      {isActive ? "Currently shopping" : feedSubtitle(feed)}
                    </Text>
                  </View>

                  {isSwitching ? (
                    <ActivityIndicator color="#1f7a5c" />
                  ) : (
                    <View className="flex-row items-center gap-1">
                      {isActive ? (
                        <View
                          className="h-6 w-6 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#1f7a5c" }}
                        >
                          <Check size={14} color="white" strokeWidth={3} />
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() => manageFeed(feed)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${feed.name}'s feed`}
                        className="h-9 w-9 items-center justify-center rounded-full active:bg-zinc-100"
                      >
                        <Settings2 size={18} color="#52525b" strokeWidth={1.75} />
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => router.push("/feed/new")}
            className="mt-4 h-14 flex-row items-center justify-center gap-2 rounded-full bg-zinc-900 active:opacity-90"
          >
            <Plus size={18} color="white" strokeWidth={2.5} />
            <Text className="font-sf-display-semibold text-[16px] text-white">
              Add someone
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/feed/settings")}
            className="mt-3 flex-row items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3.5 active:bg-zinc-50"
          >
            <View className="flex-1 pr-3">
              <Text className="text-base font-medium text-zinc-900">
                Current feed settings
              </Text>
              <Text className="mt-0.5 text-[13px] text-zinc-500">
                Relationship, interests, and budget
              </Text>
            </View>
            <ChevronRight size={20} color="#a1a1aa" />
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
