import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { ThemedView } from "@/components/themed-view";
import { ChevronDown, Plus, Ellipsis } from "lucide-react-native";

import ProductCard from "@/components/product-card/product-card";
import {
  SettingUpScreen,
  LoadingState,
} from "@/components/feed/setting-up-screen";
import {
  SelectSheet,
  type SelectSheetItem,
  type SelectSheetRef,
} from "@/components/ui/select-sheet";
import {
  bootstrapFromClerkUser,
  loadProfilesForUser,
  startSessionForProfile,
} from "@/lib/api/bootstrap";
import { ApiError, type FeedDto, type QueueItemDto } from "@/lib/api/client";
import { getApiClient } from "@/lib/api";
import { useAppUser } from "@/lib/use-app-user";
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  feedItemToQueueItem,
  interactionToSignal,
  type AppliedInteraction,
  type InteractionKind,
} from "@/lib/api/mappers";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentFeedId,
  getCurrentSessionId,
  getCurrentUserId,
} from "@/lib/state/user-context";

// Re-tapping an already-applied action undoes it. Message shown on undo.
const UNDO_MESSAGE: Record<AppliedInteraction, string> = {
  save: "Removed from your list",
  pass: "Skip undone",
  dislike: "Dislike removed",
};

function leavesAppliedState(
  type: InteractionKind,
): type is AppliedInteraction {
  return type !== "shop";
}

function isFeedQueueEmptyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const m = error.message.toLowerCase();
  if (m.includes("no items available")) return true;
  if (m.includes("no items") && m.includes("feed")) return true;
  if (error instanceof ApiError && error.status === 404) return true;
  return false;
}

export default function SwipeScreen() {
  const { user, isLoaded: isClerkUserLoaded } = useAppUser();
  const logFeedEvent = useCallback(
    (event: string, details: Record<string, unknown> = {}) => {
      console.log("[FeedDebug]", event, {
        ...details,
        userId: getCurrentUserId(),
        feedId: getCurrentFeedId(),
      });
    },
    [],
  );

  const [feedHeight, setFeedHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeFeedName, setActiveFeedName] = useState("Your gifts");
  const [availableFeeds, setAvailableFeeds] = useState<FeedDto[]>([]);
  const params = useLocalSearchParams<{
    refreshKey?: string;
    selectedFeedId?: string;
    reconnectKey?: string;
    refreshFeedKey?: string;
  }>();
  const [feedItems, setFeedItems] = useState<QueueItemDto[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  // Overlay shown over the feed area while (re)loading cards, and its error
  // variant when a load throws. "ready" hides both.
  const [feedStatus, setFeedStatus] = useState<"ready" | "loading" | "error">(
    "ready",
  );
  const [feedError, setFeedError] = useState<string | null>(null);
  // True while the very first batch is loading or the backend is still computing
  // recommendations (no cards yet). Drives the full-area "preparing" state so
  // the feed never sits blank; false + zero items means a genuinely empty feed.
  const [feedPreparing, setFeedPreparing] = useState(true);
  // Bumped to cancel any in-flight polling loop (feed switch, refresh, unmount).
  const pollTokenRef = useRef(0);
  const [interactionInFlight, setInteractionInFlight] = useState(false);
  const [activeInteractionType, setActiveInteractionType] =
    useState<AppliedInteraction | null>(null);
  const [interactionByItemId, setInteractionByItemId] = useState<
    Record<string, AppliedInteraction>
  >({});
  const [pendingScrollIndex, setPendingScrollIndex] = useState<number | null>(
    null,
  );
  const feedListRef = useRef<FlatList<QueueItemDto>>(null);
  const interactedItemIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedClerkUserIdRef = useRef<string | null>(null);
  const bottomSheetRef = useRef<SelectSheetRef>(null);
  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();
  const navigation = useNavigation();

  // Instagram-style: tapping the Home tab while already on it jumps back to the
  // top of the feed rather than re-navigating.
  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as never, () => {
      if (feedItems.length > 0 && feedHeight > 0) {
        feedListRef.current?.scrollToIndex({ index: 0, animated: true });
        setCurrentCardIndex(0);
      }
    });
    return unsubscribe;
  }, [navigation, feedItems.length, feedHeight]);

  useEffect(() => {
    let cancelled = false;

    const checkApiHealth = async () => {
      try {
        const health = await api.getHealth();
        if (!cancelled) {
          console.log("[GiftGenius API] connected", health);
          console.log("[GiftGenius API] current user context", {
            userId: getCurrentUserId(),
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[GiftGenius API] health check failed", error);
        }
      }
    };

    checkApiHealth();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const bootstrapUserAndFeed = useCallback(async () => {
    if (!user) {
      throw new Error("Sign in to load your feed.");
    }
    const result = await bootstrapFromClerkUser(api, user);
    setAvailableFeeds(result.profiles);
    if (result.activeProfile) {
      setActiveFeedName(result.activeProfile.name);
    }
    return result;
  }, [api, user]);

  const loadMoreFeedItems = useCallback(async () => {
    const sessionId = getCurrentSessionId();
    if (!sessionId) {
      throw new Error("Your feed isn’t ready yet. Pull down to refresh.");
    }

    setFeedLoading(true);
    try {
      const batch = await api.getFeedBatch(sessionId, 10);
      const mapped = batch.items.map(feedItemToQueueItem);
      logFeedEvent("load_feed_batch", {
        sessionId,
        count: mapped.length,
      });
      setFeedItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const fresh = mapped.filter((item) => !seen.has(item.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
      return { count: mapped.length, preparing: batch.preparing ?? false };
    } finally {
      setFeedLoading(false);
    }
  }, [api, logFeedEvent]);

  // Runs a feed load behind the "loading" overlay, keeping it up for a fixed
  // 5s (placeholder for now), and flips to the error overlay if the load throws.
  const runFeedLoad = useCallback(async (task: () => Promise<void>) => {
    const FEED_LOADING_MS = 5000;
    setFeedError(null);
    setFeedStatus("loading");
    const startedAt = Date.now();
    try {
      await task();
      const remaining = FEED_LOADING_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setFeedStatus("ready");
    } catch (error) {
      setFeedError(friendlyErrorMessage(error, "Couldn't load your feed."));
      setFeedStatus("error");
    }
  }, []);

  const stopFeedPolling = useCallback(() => {
    pollTokenRef.current += 1;
  }, []);

  // Poll the feed while the backend reports it's still preparing, until items
  // arrive, the profile is genuinely empty, or we hit the max wait.
  const startFeedPolling = useCallback(() => {
    const token = ++pollTokenRef.current;
    const startedAt = Date.now();
    const MAX_WAIT_MS = 3 * 60 * 1000;
    const INTERVAL_MS = 4000;

    const tick = async () => {
      if (token !== pollTokenRef.current) return;
      try {
        const { count, preparing } = await loadMoreFeedItems();
        if (token !== pollTokenRef.current) return;
        if (count > 0) {
          setFeedPreparing(false);
          return;
        }
        // Backend finished computing but there's nothing to show.
        if (!preparing) {
          setFeedPreparing(false);
          return;
        }
      } catch {
        if (token !== pollTokenRef.current) return;
        // Transient error — keep retrying until the max wait.
      }
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        setFeedPreparing(false);
        return;
      }
      setTimeout(tick, INTERVAL_MS);
    };

    setTimeout(tick, INTERVAL_MS);
  }, [loadMoreFeedItems]);

  useEffect(() => stopFeedPolling, [stopFeedPolling]);

  const resetAndLoadFeedCards = useCallback(async (): Promise<void> => {
    stopFeedPolling();
    setFeedItems([]);
    setCurrentCardIndex(0);
    interactedItemIdsRef.current.clear();
    setInteractionByItemId({});
    setFeedPreparing(true);
    try {
      const { count, preparing } = await loadMoreFeedItems();
      if (count > 0) {
        setFeedPreparing(false);
      } else if (preparing) {
        // Empty but still being computed for the first time — poll until items
        // arrive instead of dead-ending on an empty state.
        startFeedPolling();
      } else {
        // Genuinely empty feed.
        setFeedPreparing(false);
      }
    } catch (error) {
      setFeedPreparing(false);
      if (isFeedQueueEmptyError(error)) return;
      throw error;
    }
  }, [loadMoreFeedItems, startFeedPolling, stopFeedPolling]);

  const switchToFeed = useCallback(
    async (feed: FeedDto) => {
      try {
        await startSessionForProfile(api, feed.id);
        setActiveFeedName(feed.name);
        logFeedEvent("feed_switch", {
          nextProfileId: feed.id,
          nextProfileName: feed.name,
        });
        await resetAndLoadFeedCards();
        bottomSheetRef.current?.dismiss();
      } catch (error) {
        toast.show({ message: friendlyErrorMessage(error), variant: "error" });
      }
    },
    [api, logFeedEvent, resetAndLoadFeedCards, toast],
  );

  // Feed rows for the switcher sheet: title is the feed name, subtitle a
  // "relationship • occasion • budget" summary (fields that are set).
  const feedSelectItems: SelectSheetItem[] = useMemo(
    () =>
      availableFeeds.map((feed) => {
        const budget =
          feed.budgetMin != null && feed.budgetMax != null
            ? `$${feed.budgetMin} - $${feed.budgetMax}`
            : null;
        const subtitle = [feed.relationship, feed.occasion, budget]
          .filter(Boolean)
          .join(" • ");
        return {
          id: feed.id,
          title: feed.name,
          subtitle: subtitle.length > 0 ? subtitle : undefined,
        };
      }),
    [availableFeeds],
  );

  const selectedFeedId = useMemo(
    () => availableFeeds.find((feed) => feed.name === activeFeedName)?.id ?? null,
    [availableFeeds, activeFeedName],
  );

  useEffect(() => {
    const selectedProfileId = params.selectedFeedId?.trim();
    if (!params.refreshKey || !selectedProfileId) {
      return;
    }

    const refreshAfterCreate = async () => {
      const userId = getCurrentUserId();
      if (!userId) return;

      try {
        const profiles = await loadProfilesForUser(api, userId);
        setAvailableFeeds(profiles);
        const selectedProfile = profiles.find(
          (feed) => feed.id === selectedProfileId,
        );
        if (selectedProfile) {
          await switchToFeed(selectedProfile);
        }
      } catch (error) {
        toast.show({ message: friendlyErrorMessage(error), variant: "error" });
      }
    };

    refreshAfterCreate();
  }, [api, params.refreshKey, params.selectedFeedId, switchToFeed, toast]);

  // Reload feed after interest changes in feed settings.
  useEffect(() => {
    if (!params.refreshFeedKey) return;

    let cancelled = false;
    (async () => {
      try {
        const profileId = getCurrentFeedId();
        if (profileId) {
          await startSessionForProfile(api, profileId);
        }
        if (cancelled) return;
        await resetAndLoadFeedCards();
      } catch (error) {
        if (!cancelled) {
          toast.show({
            message: friendlyErrorMessage(error, "Couldn't refresh your feed."),
            variant: "error",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, params.refreshFeedKey, resetAndLoadFeedCards, toast]);

  const advanceToNextCard = useCallback(async () => {
    const nextIndex = currentCardIndex + 1;
    const isAtEnd = currentCardIndex >= feedItems.length - 1;
    if (isAtEnd) {
      // Reached the end of the feed — show the loading overlay while more loads.
      await runFeedLoad(async () => {
        await loadMoreFeedItems();
      });
    }
    setCurrentCardIndex(nextIndex);
    if (nextIndex < feedItems.length || !isAtEnd) {
      feedListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      setPendingScrollIndex(nextIndex);
    }
  }, [currentCardIndex, feedItems.length, loadMoreFeedItems, runFeedLoad]);

  const submitInteraction = useCallback(
    async (type: InteractionKind, opts?: { clear?: boolean }) => {
      const currentItem = feedItems[currentCardIndex];
      if (!currentItem) {
        return;
      }

      // Re-tapping an already-applied action toggles it off (undo). Only the
      // visual actions (save/dislike/pass) leave an applied state to clear.
      const appliedForItem = interactionByItemId[currentItem.id];
      const isUndo =
        opts?.clear === true &&
        leavesAppliedState(type) &&
        appliedForItem === type;

      setInteractionInFlight(true);
      setActiveInteractionType(null);
      try {
        if (isUndo) {
          logFeedEvent("interaction_undo", {
            type,
            itemId: currentItem.id,
            itemTitle: currentItem.title,
            currentCardIndex,
          });
          // Clear the recorded signal on the backend (reverses its side effects)
          // and locally, so the button reads as inactive again. No scroll.
          await api.deleteSignal(currentItem.id);
          interactedItemIdsRef.current.delete(currentItem.id);
          setInteractionByItemId((prev) => {
            const next = { ...prev };
            delete next[currentItem.id];
            return next;
          });
          toast.show({
            message: UNDO_MESSAGE[type as AppliedInteraction],
            variant: "info",
          });
          return;
        }

        const isVisualState = leavesAppliedState(type);
        setActiveInteractionType(isVisualState ? type : null);
        logFeedEvent("interaction_submit", {
          type,
          itemId: currentItem.id,
          itemTitle: currentItem.title,
          currentCardIndex,
        });
        await api.postSignal(currentItem.id, interactionToSignal(type));
        interactedItemIdsRef.current.add(currentItem.id);
        if (isVisualState) {
          setInteractionByItemId((prev) => ({
            ...prev,
            [currentItem.id]: type,
          }));
        }

        if (type === "save") {
          toast.show({ message: "Saved to your list", variant: "saved" });
        } else if (type === "dislike") {
          toast.show({
            message: "Got it — we’ll show fewer like this",
            variant: "info",
          });
        } else if (type === "shop") {
          toast.show({ message: "Opening Amazon…", variant: "info" });
        }

        // Card actions (save/dislike/shop) keep the user on the current card so
        // they can undo in place or come back after buying — the user advances
        // the feed by scrolling. Only a programmatic "pass" advances.
        if (type === "pass") {
          await advanceToNextCard();
        }
      } catch (error) {
        toast.show({ message: friendlyErrorMessage(error), variant: "error" });
      } finally {
        setInteractionInFlight(false);
        setActiveInteractionType(null);
      }
    },
    [
      api,
      advanceToNextCard,
      currentCardIndex,
      feedItems,
      interactionByItemId,
      logFeedEvent,
      toast,
    ],
  );

  // Bootstrap exactly once per signed-in user. Depends ONLY on stable values
  // (the Clerk user id string + load flag) so Clerk re-renders / state updates
  // can't re-run this and cancel an in-flight bootstrap (which used to leave the
  // screen stuck on "Setting things up…").
  useEffect(() => {
    if (!isClerkUserLoaded) return;

    if (!user) {
      bootstrappedClerkUserIdRef.current = null;
      setBootstrapping(false);
      return;
    }

    // Already bootstrapped this user on this mount.
    if (bootstrappedClerkUserIdRef.current === user.id) return;
    bootstrappedClerkUserIdRef.current = user.id;

    // Arriving right after creating a recipient: feed/new already set the active
    // profile + session, and the post-create effect loads the feed. Skip.
    if (
      params.selectedFeedId &&
      getCurrentUserId() != null &&
      getCurrentSessionId() != null
    ) {
      setBootstrapping(false);
      return;
    }

    let cancelled = false;
    let redirecting = false;
    setBootstrapping(true);

    (async () => {
      try {
        const result = await bootstrapUserAndFeed();
        if (cancelled) return;

        // Brand-new user with no recipients → guide them to create one.
        if (result.needsOnboarding) {
          redirecting = true;
          router.replace("/feed/new?onboarding=1");
          return;
        }

        await resetAndLoadFeedCards();
      } catch (error) {
        if (!cancelled) {
          // Allow a retry via pull-to-refresh / next mount.
          bootstrappedClerkUserIdRef.current = null;
          setFeedPreparing(false);
          toast.show({
            message: friendlyErrorMessage(error, "We couldn’t load your gifts."),
            variant: "error",
          });
          setActiveFeedName("Setup needed");
        }
      } finally {
        if (!cancelled && !redirecting) {
          setBootstrapping(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // bootstrapUserAndFeed / resetAndLoadFeedCards are intentionally omitted —
    // including them re-runs this effect on every render and thrashes bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClerkUserLoaded, user?.id]);

  const onRefresh = useCallback(() => {
    const refresh = async () => {
      setRefreshing(true);
      try {
        await runFeedLoad(async () => {
          const result = await bootstrapUserAndFeed();
          if (result.needsOnboarding) {
            router.replace("/feed/new?onboarding=1");
            return;
          }
          await resetAndLoadFeedCards();
        });
      } finally {
        setRefreshing(false);
      }
    };

    refresh();
  }, [bootstrapUserAndFeed, resetAndLoadFeedCards, runFeedLoad]);

  const onFeedScrollEnd = useCallback(
    async (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!feedHeight) return;

      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.y / feedHeight,
      );
      const previousIndex = currentCardIndex;
      const minAllowedIndex = Math.max(0, previousIndex - 5);
      if (nextIndex < minAllowedIndex) {
        feedListRef.current?.scrollToIndex({
          index: minAllowedIndex,
          animated: true,
        });
        setCurrentCardIndex(minAllowedIndex);
        return;
      }

      if (nextIndex > previousIndex) {
        setInteractionInFlight(true);
        try {
          for (let index = previousIndex; index < nextIndex; index += 1) {
            const skippedItem = feedItems[index];
            if (!skippedItem) continue;
            if (interactedItemIdsRef.current.has(skippedItem.id)) continue;
            logFeedEvent("auto_pass_on_scroll", {
              fromIndex: previousIndex,
              toIndex: nextIndex,
              passIndex: index,
              itemId: skippedItem.id,
              itemTitle: skippedItem.title,
            });
            await api.postSignal(skippedItem.id, "skip");
            interactedItemIdsRef.current.add(skippedItem.id);
            setInteractionByItemId((prev) => ({
              ...prev,
              [skippedItem.id]: "pass",
            }));
          }
        } catch (error) {
          toast.show({
            message: friendlyErrorMessage(error),
            variant: "error",
          });
        } finally {
          setInteractionInFlight(false);
        }
      }

      setCurrentCardIndex(nextIndex);
      const visibleItem = feedItems[nextIndex];
      logFeedEvent("scroll_end", {
        previousIndex,
        nextIndex,
        visibleItemId: visibleItem?.id ?? null,
        visibleItemTitle: visibleItem?.title ?? null,
      });
      if (nextIndex >= feedItems.length - 1 && !feedLoading) {
        // Reached the end of the feed — show the loading overlay while more loads.
        await runFeedLoad(async () => {
          await loadMoreFeedItems();
        });
      }
    },
    [
      api,
      currentCardIndex,
      feedHeight,
      feedItems,
      feedLoading,
      loadMoreFeedItems,
      logFeedEvent,
      runFeedLoad,
      toast,
    ],
  );

  // Stable handler for every card. submitInteraction's identity changes after
  // each interaction (its deps include feedItems/interactionByItemId); passing
  // it directly would change the onInteraction prop on every card and defeat
  // ProductCard's memoization. The ref always points at the latest closure.
  const submitInteractionRef = useRef(submitInteraction);
  submitInteractionRef.current = submitInteraction;
  const handleInteraction = useCallback(
    (type: InteractionKind, opts?: { clear?: boolean }) => {
      submitInteractionRef.current(type, opts);
    },
    [],
  );

  const renderFeedItem = useCallback(
    ({ item }: { item: QueueItemDto }) => {
      // Only the visible card needs the in-flight flags; keeping them false on
      // the rest leaves their props stable so memoized cards don't re-render.
      const isCurrent = feedItems[currentCardIndex]?.id === item.id;
      return (
        <View style={{ height: feedHeight }} className="w-full py-2">
          <ProductCard
            item={item}
            interactionInFlight={isCurrent ? interactionInFlight : false}
            activeInteractionType={
              isCurrent && interactionInFlight ? activeInteractionType : null
            }
            appliedInteractionType={interactionByItemId[item.id] ?? null}
            onInteraction={handleInteraction}
          />
        </View>
      );
    },
    [
      activeInteractionType,
      currentCardIndex,
      feedHeight,
      feedItems,
      interactionByItemId,
      interactionInFlight,
      handleInteraction,
    ],
  );

  useEffect(() => {
    if (pendingScrollIndex == null) return;
    if (pendingScrollIndex >= feedItems.length) return;

    requestAnimationFrame(() => {
      feedListRef.current?.scrollToIndex({
        index: pendingScrollIndex,
        animated: true,
      });
      setPendingScrollIndex(null);
    });
  }, [feedItems.length, pendingScrollIndex]);

  useEffect(() => {
    const visibleItem = feedItems[currentCardIndex];
    if (!visibleItem) return;
    logFeedEvent("visible_card_state", {
      currentCardIndex,
      itemId: visibleItem.id,
      itemTitle: visibleItem.title,
      loadedCards: feedItems.length,
      feedLoading,
      interactionInFlight,
    });
  }, [
    currentCardIndex,
    feedItems,
    feedLoading,
    interactionInFlight,
    logFeedEvent,
  ]);

  useFocusEffect(
    useCallback(() => {
      const userId = getCurrentUserId();
      const profileId = getCurrentFeedId();
      if (!userId || !profileId) return;

      let cancelled = false;
      (async () => {
        try {
          const profiles = await loadProfilesForUser(api, userId);
          if (cancelled) return;
          setAvailableFeeds(profiles);
          const current = profiles.find((f) => f.id === profileId);
          if (current) {
            setActiveFeedName(current.name);
          }
        } catch {
          /* keep existing header if refresh fails */
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [api]),
  );

  if (bootstrapping) {
    return <SettingUpScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <ThemedView className="w-full h-full bg-white">
        <View className="w-full flex-row items-center px-4 pb-4 pt-2 border-b border-zinc-200">
          <View className="flex-1 flex-row justify-start">
            <Text>Logo</Text>
          </View>
          <Pressable
            className="flex shrink flex-row justify-center items-center gap-2"
            accessibilityRole="button"
            accessibilityLabel={`Switch person, currently ${activeFeedName}`}
            hitSlop={8}
            onPress={() => bottomSheetRef.current?.present()}
          >
            <Text
              className="shrink text-lg text-slate-800"
              fontStyle="noto-serif-bold"
              numberOfLines={1}
            >
              {activeFeedName}
            </Text>
            <View className="mt-2">
              <ChevronDown size={24} color="black" strokeWidth={1.5} />
            </View>
          </Pressable>
          <View className="flex-1 flex-row justify-end">
            <Ellipsis size={24} color="black" />
          </View>
        </View>
        <View className="relative flex-1 px-2">
          <View
            className="w-full h-full"
            onLayout={(e) => setFeedHeight(e.nativeEvent.layout.height)}
          >
            <FlatList
              ref={feedListRef}
              data={feedItems}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={renderFeedItem}
              showsVerticalScrollIndicator={false}
              pagingEnabled
              decelerationRate="fast"
              onMomentumScrollEnd={onFeedScrollEnd}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              getItemLayout={(_, index) => ({
                length: feedHeight,
                offset: feedHeight * index,
                index,
              })}
              onScrollToIndexFailed={({ index }) => {
                setTimeout(() => {
                  feedListRef.current?.scrollToIndex({ index, animated: true });
                }, 50);
              }}
            />
          </View>
          {feedItems.length === 0 && feedStatus === "ready" ? (
            feedPreparing ? (
              <View className="absolute inset-0 items-center justify-center bg-white">
                <LoadingState
                  title="Getting your feed ready…"
                  subtitle={`Finding gifts for ${activeFeedName}.`}
                />
              </View>
            ) : (
              <View className="absolute inset-0 items-center justify-center bg-white px-8">
                <Text
                  className="text-center text-lg text-zinc-900"
                  fontStyle="noto-serif-bold"
                >
                  No gifts to show yet
                </Text>
                <Text className="mt-2 text-center text-sm text-zinc-500">
                  We couldn’t find gifts for {activeFeedName} right now. Pull to
                  refresh, or tweak their interests and budget.
                </Text>
                <Pressable
                  className="mt-4 h-11 flex-row items-center justify-center rounded-full bg-zinc-900 px-6"
                  accessibilityRole="button"
                  onPress={onRefresh}
                >
                  <Text className="font-sf-display-semibold text-white">
                    Refresh
                  </Text>
                </Pressable>
              </View>
            )
          ) : null}
          {feedStatus === "loading" ? (
            <View className="absolute inset-0 items-center justify-center bg-white">
              <LoadingState
                title="Loading more items…"
                subtitle="Finding more gifts for you."
              />
            </View>
          ) : null}
          {feedStatus === "error" ? (
            <View className="absolute inset-0 items-center justify-center bg-white px-8">
              <Text
                className="text-center text-lg text-zinc-900"
                fontStyle="noto-serif-bold"
              >
                Something went wrong
              </Text>
              <Text className="mt-2 text-center text-sm text-zinc-500">
                {feedError ?? "Couldn't load your feed."}
              </Text>
              <Pressable
                className="mt-4 h-11 flex-row items-center justify-center rounded-full bg-zinc-900 px-6"
                accessibilityRole="button"
                onPress={onRefresh}
              >
                <Text className="font-sf-display-semibold text-white">
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ThemedView>
      <SelectSheet
        ref={bottomSheetRef}
        heading="Feeds"
        subheading="Switch your feed to shop for someone else."
        data={feedSelectItems}
        selectedId={selectedFeedId}
        onSelect={(item) => {
          const feed = availableFeeds.find((f) => f.id === item.id);
          if (feed) switchToFeed(feed);
        }}
        ctaLabel="Add someone"
        ctaIcon={<Plus size={18} color="white" strokeWidth={2.5} />}
        ctaSlug="/feed/start"
      />
    </SafeAreaView>
  );
}
