import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { Check, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react-native";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { Separator } from "@/components/ui/separator";
import { SheetBackground } from "@/components/ui/sheet-background";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { getApiClient } from "@/lib/api";
import {
  loadProfilesForUser,
  startSessionForProfile,
} from "@/lib/api/bootstrap";
import type { FeedDto } from "@/lib/api/client";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { removeStoredProfileId } from "@/lib/state/profile-store";
import {
  getCurrentFeedId,
  getCurrentUserId,
  setCurrentProfile,
  setCurrentSession,
} from "@/lib/state/user-context";

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

export default function FeedsScreen() {
  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const actionsSheetRef = useRef<BottomSheetModal>(null);

  const [feeds, setFeeds] = useState<FeedDto[]>([]);
  const [activeFeedId, setActiveFeedId] = useState<string | null>(() =>
    getCurrentFeedId(),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionsFeed, setActionsFeed] = useState<FeedDto | null>(null);

  const loadFeeds = useCallback(
    async (isRefresh = false) => {
      const userId = getCurrentUserId();
      if (!userId) {
        setFeeds([]);
        setError("Sign in to manage your feeds.");
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
        setError(friendlyErrorMessage(err, "Couldn't load your feeds."));
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
      if (feed.id === activeFeedId || busyId) return;
      setBusyId(feed.id);
      try {
        await startSessionForProfile(api, feed.id);
        setActiveFeedId(feed.id);
        toast.show({
          message: `Now shopping for ${feed.name}`,
          variant: "success",
        });
      } catch (err) {
        toast.show({ message: friendlyErrorMessage(err), variant: "error" });
      } finally {
        setBusyId(null);
      }
    },
    [activeFeedId, api, busyId, toast],
  );

  const editFeed = useCallback(
    async (feed: FeedDto) => {
      // The edit screen operates on the active feed, so switch to it first.
      if (feed.id !== activeFeedId) {
        setBusyId(feed.id);
        try {
          await startSessionForProfile(api, feed.id);
          setActiveFeedId(feed.id);
        } catch (err) {
          toast.show({ message: friendlyErrorMessage(err), variant: "error" });
          return;
        } finally {
          setBusyId(null);
        }
      }
      router.push("/feed/edit");
    },
    [activeFeedId, api, toast],
  );

  const deleteFeed = useCallback(
    async (feed: FeedDto) => {
      const userId = getCurrentUserId();
      setBusyId(feed.id);
      try {
        await api.deleteProfile(feed.id);
        if (userId) await removeStoredProfileId(userId, feed.id);

        // Clear the active session if we just deleted the feed being shopped.
        if (getCurrentFeedId() === feed.id) {
          setCurrentProfile(null);
          setCurrentSession(null);
          setActiveFeedId(null);
        }

        setFeeds((prev) => prev.filter((f) => f.id !== feed.id));
        toast.show({ message: `Deleted ${feed.name}`, variant: "success" });
      } catch (err) {
        toast.show({ message: friendlyErrorMessage(err), variant: "error" });
      } finally {
        setBusyId(null);
      }
    },
    [api, toast],
  );

  const confirmDelete = useCallback(
    (feed: FeedDto) => {
      Alert.alert(
        `Delete ${feed.name}?`,
        "This permanently removes their feed and everything you saved for them. This can't be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteFeed(feed),
          },
        ],
      );
    },
    [deleteFeed],
  );

  const openActions = useCallback((feed: FeedDto) => {
    setActionsFeed(feed);
    actionsSheetRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-4 pb-4 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl text-slate-700" fontStyle="noto-serif-bold">
            Your feeds
          </Text>
          <Pressable
            onPress={() => router.push("/feed/start")}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Add someone"
            className="h-8 w-8 items-center justify-center rounded-full bg-slate-900 active:opacity-80"
          >
            <Plus size={16} color="white" strokeWidth={2.5} />
          </Pressable>
        </View>
        <Text className="pt-1" fontStyle="sf-display-light">
          Switch, edit, or manage your lists.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1f7a5c" />
          <Text className="mt-3 text-slate-500" fontStyle="sf-display-light">
            Loading feeds…
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-8"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFeeds(true)}
              tintColor="#1f7a5c"
            />
          }
        >
          {error ? (
            <View className="rounded-xl border border-red-200 bg-red-50 p-4">
              <Text className="text-sm text-red-700" fontStyle="sf-display-medium">
                {error}
              </Text>
              <Pressable onPress={() => loadFeeds()} className="mt-3 self-start">
                <Text
                  className="text-sm text-red-800 underline"
                  fontStyle="sf-display-medium"
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!error && feeds.length === 0 ? (
            <View className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <Text
                className="text-base text-slate-900"
                fontStyle="sf-display-semibold"
              >
                No feeds yet
              </Text>
              <Text
                className="mt-1.5 text-sm text-slate-500"
                fontStyle="sf-display-light"
              >
                Add someone you’re shopping for to start building their gift
                feed.
              </Text>
            </View>
          ) : null}

          <View>
            {feeds.map((feed, index) => {
              const isActive = feed.id === activeFeedId;
              const isBusy = busyId === feed.id;
              return (
                <Fragment key={feed.id}>
                  {index > 0 ? <Separator /> : null}
                  <Pressable
                    disabled={isBusy}
                    onPress={() => switchToFeed(feed)}
                    className="flex-row items-center justify-between py-4 active:opacity-60"
                  >
                    <View className="flex-1 pr-3">
                      <Text
                        className="text-base text-slate-900"
                        fontStyle="sf-display-semibold"
                      >
                        {feed.name}
                      </Text>
                      <Text
                        className={`mt-0.5 text-[13px] ${
                          isActive ? "text-primary" : "text-slate-500"
                        }`}
                        fontStyle="sf-display-light"
                        numberOfLines={1}
                      >
                        {isActive ? "Currently shopping" : feedSubtitle(feed)}
                      </Text>
                    </View>

                    {isBusy ? (
                      <ActivityIndicator color="#1f7a5c" />
                    ) : (
                      <View className="flex-row items-center gap-1.5">
                        {isActive ? (
                          <View className="h-6 w-6 items-center justify-center rounded-full bg-primary">
                            <Check size={14} color="white" strokeWidth={3} />
                          </View>
                        ) : null}
                        <Pressable
                          onPress={() => openActions(feed)}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={`Manage ${feed.name}'s feed`}
                          className="h-9 w-9 items-center justify-center rounded-full active:bg-slate-100"
                        >
                          <MoreVertical
                            size={18}
                            color="#64748b"
                            strokeWidth={2}
                          />
                        </Pressable>
                      </View>
                    )}
                  </Pressable>
                </Fragment>
              );
            })}
          </View>
        </ScrollView>
      )}

      <BottomSheetModal
        ref={actionsSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        topInset={insets.top}
        backdropComponent={renderBackdrop}
        backgroundComponent={SheetBackground}
        handleIndicatorStyle={{ backgroundColor: "#ccc" }}
      >
        <BottomSheetView
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16 + insets.bottom,
          }}
        >
          <View>
            <Text
              className="text-left text-xl text-slate-700"
              fontStyle="noto-serif-bold"
            >
              {actionsFeed?.name ?? "Feed"}
            </Text>
            <Text
              className="px-1 pb-6 pt-1 text-left"
              fontStyle="sf-display-light"
              numberOfLines={1}
            >
              {actionsFeed ? feedSubtitle(actionsFeed) : ""}
            </Text>
          </View>

          <View className="gap-2.5">
            <Pressable
              onPress={() => {
                const feed = actionsFeed;
                actionsSheetRef.current?.dismiss();
                if (feed) editFeed(feed);
              }}
              className="flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: "rgba(255,255,255,0.5)" }}
            >
              <Pencil size={20} color="#3f3f46" strokeWidth={2} />
              <Text
                className="text-base font-sf-display-semibold"
                style={{ color: "#3f3f46" }}
              >
                Edit feed
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const feed = actionsFeed;
                actionsSheetRef.current?.dismiss();
                if (feed) confirmDelete(feed);
              }}
              className="flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: "rgba(255,255,255,0.5)" }}
            >
              <Trash2 size={20} color="#dc2626" strokeWidth={2} />
              <Text
                className="text-base font-sf-display-semibold"
                style={{ color: "#dc2626" }}
              >
                Delete feed
              </Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}
