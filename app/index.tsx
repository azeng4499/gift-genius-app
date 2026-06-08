import { useUser } from "@clerk/clerk-expo";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  Bookmark,
  ChevronDown,
  CircleUserRound,
  House,
  SlidersHorizontal,
} from "lucide-react-native";

import ProductCard from "@/components/product-card/product-card";
import {
  bootstrapFromClerkUser,
  loadProfilesForUser,
  startSessionForProfile,
} from "@/lib/api/bootstrap";
import {
  ApiError,
  createGiftGeniusApiClient,
  type FeedDto,
  type QueueItemDto,
} from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import { feedItemToQueueItem, interactionToSignal } from "@/lib/api/mappers";
import {
  getAccessToken,
  getCurrentFeedId,
  getCurrentSessionId,
  getCurrentUserId,
} from "@/lib/state/user-context";

function isFeedQueueEmptyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const m = error.message.toLowerCase();
  if (m.includes("no items available")) return true;
  if (m.includes("no items") && m.includes("feed")) return true;
  if (error instanceof ApiError && error.status === 404) return true;
  return false;
}

export default function SwipeScreen() {
  const { user } = useUser();
  const logFeedEvent = useCallback(
    (event: string, details: Record<string, unknown> = {}) => {
      console.log("[FeedDebug]", event, {
        ...details,
        userId: getCurrentUserId(),
        feedId: getCurrentFeedId(),
      });
    },
    []
  );

  const insets = useSafeAreaInsets();
  const [feedHeight, setFeedHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFeedName, setActiveFeedName] = useState("Loading feed...");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [availableFeeds, setAvailableFeeds] = useState<FeedDto[]>([]);
  const [newFeedName, setNewFeedName] = useState("");
  const [creatingFeed, setCreatingFeed] = useState(false);
  const params = useLocalSearchParams<{
    refreshKey?: string;
    selectedFeedId?: string;
    reconnectKey?: string;
  }>();
  const [feedItems, setFeedItems] = useState<QueueItemDto[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [interactionInFlight, setInteractionInFlight] = useState(false);
  const [activeInteractionType, setActiveInteractionType] = useState<
    "like" | "pass" | "save" | null
  >(null);
  const [interactionByItemId, setInteractionByItemId] = useState<
    Record<string, "like" | "pass" | "save">
  >({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingScrollIndex, setPendingScrollIndex] = useState<number | null>(null);
  const feedListRef = useRef<FlatList<QueueItemDto>>(null);
  const interactedItemIdsRef = useRef<Set<string>>(new Set());
  const hasBootstrappedRef = useRef(false);
  const actionMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%", "100%"], []);
  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

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
    setActiveFeedName(result.activeProfile.name);
  }, [api, user]);

  const loadMoreFeedItems = useCallback(async () => {
    const sessionId = getCurrentSessionId();
    if (!sessionId) {
      throw new Error("Missing feed session. Run setup first.");
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
      return mapped.length;
    } finally {
      setFeedLoading(false);
    }
  }, [api, logFeedEvent]);

  const resetAndLoadFeedCards = useCallback(async (): Promise<boolean> => {
    setFeedItems([]);
    setCurrentCardIndex(0);
    interactedItemIdsRef.current.clear();
    setInteractionByItemId({});
    try {
      const count = await loadMoreFeedItems();
      if (count === 0) {
        setBootstrapError(
          "No recommendations are in the queue for this feed yet. Try another profile from the menu, open feed settings, or ensure the backend catalog is stocked."
        );
        return true;
      }
      return false;
    } catch (error) {
      if (isFeedQueueEmptyError(error)) {
        setBootstrapError(
          "No recommendations are in the queue for this feed yet. Try another profile from the menu, open feed settings, or ensure the backend catalog is stocked."
        );
        return true;
      }
      throw error;
    }
  }, [loadMoreFeedItems]);

  const switchToFeed = useCallback(
    async (feed: FeedDto) => {
      try {
        await startSessionForProfile(api, feed.id);
        setActiveFeedName(feed.name);
        logFeedEvent("feed_switch", { nextProfileId: feed.id, nextProfileName: feed.name });
        const queueEmpty = await resetAndLoadFeedCards();
        if (!queueEmpty) {
          setBootstrapError(null);
        }
        bottomSheetRef.current?.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to switch feed";
        setBootstrapError(message);
      }
    },
    [api, logFeedEvent, resetAndLoadFeedCards]
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
        const selectedProfile = profiles.find((feed) => feed.id === selectedProfileId);
        if (selectedProfile) {
          await switchToFeed(selectedProfile);
        } else {
          setBootstrapError(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to refresh feeds";
        setBootstrapError(message);
      }
    };

    refreshAfterCreate();
  }, [api, params.refreshKey, params.selectedFeedId, switchToFeed]);

  const submitInteraction = useCallback(
    async (type: "like" | "pass" | "save", opts?: { clear?: boolean }) => {
      const currentItem = feedItems[currentCardIndex];
      if (!currentItem) {
        return;
      }

      const clearing = !!opts?.clear;
      const appliedForItem = interactionByItemId[currentItem.id];
      if (clearing && appliedForItem !== type) {
        return;
      }

      setInteractionInFlight(true);
      setActiveInteractionType(type);
      try {
        if (clearing) {
          setActionMessage("Undo isn't supported on the new API yet.");
          if (actionMessageTimeoutRef.current) {
            clearTimeout(actionMessageTimeoutRef.current);
          }
          actionMessageTimeoutRef.current = setTimeout(() => {
            setActionMessage(null);
          }, 1500);
          return;
        }

        logFeedEvent("interaction_submit", {
          type,
          itemId: currentItem.id,
          itemTitle: currentItem.title,
          currentCardIndex,
        });
        await api.postSignal(currentItem.id, interactionToSignal(type));
        interactedItemIdsRef.current.add(currentItem.id);
        setInteractionByItemId((prev) => ({ ...prev, [currentItem.id]: type }));
        if (type === "save") {
          setActionMessage("Saved to your saved items");
        } else if (type === "pass") {
          setActionMessage("Skipped this item");
        }
        if (actionMessageTimeoutRef.current) {
          clearTimeout(actionMessageTimeoutRef.current);
        }
        actionMessageTimeoutRef.current = setTimeout(() => {
          setActionMessage(null);
        }, 1500);

        const nextIndex = currentCardIndex + 1;
        const isAtEnd = currentCardIndex >= feedItems.length - 1;
        if (isAtEnd) {
          await loadMoreFeedItems();
        }
        setCurrentCardIndex(nextIndex);
        if (nextIndex < feedItems.length || !isAtEnd) {
          feedListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        } else {
          setPendingScrollIndex(nextIndex);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Interaction failed";
        setBootstrapError(message);
      } finally {
        setInteractionInFlight(false);
        setActiveInteractionType(null);
      }
    },
    [api, currentCardIndex, feedItems, interactionByItemId, loadMoreFeedItems, logFeedEvent]
  );

  useEffect(() => {
    let cancelled = false;

    const runBootstrap = async () => {
      if (hasBootstrappedRef.current || !user) return;
      hasBootstrappedRef.current = true;
      try {
        await bootstrapUserAndFeed();
        const queueEmpty = await resetAndLoadFeedCards();
        if (!cancelled) {
          if (!queueEmpty) {
            setBootstrapError(null);
          }
          console.log("[GiftGenius API] user/feed bootstrap complete", {
            userId: getCurrentUserId(),
          });
        }
      } catch (error) {
        hasBootstrappedRef.current = false;
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Failed to load user/feed";
          setBootstrapError(message);
          setActiveFeedName("Setup required");
          console.warn("[GiftGenius API] user/feed bootstrap failed", error);
        }
      }
    };

    runBootstrap();
    return () => {
      cancelled = true;
    };
  }, [bootstrapUserAndFeed, resetAndLoadFeedCards, user]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const onRefresh = useCallback(() => {
    const refresh = async () => {
      setRefreshing(true);
      try {
        await bootstrapUserAndFeed();
        const queueEmpty = await resetAndLoadFeedCards();
        if (!queueEmpty) {
          setBootstrapError(null);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Refresh failed";
        setBootstrapError(message);
      } finally {
        setRefreshing(false);
      }
    };

    refresh();
  }, [bootstrapUserAndFeed, resetAndLoadFeedCards, user]);

  const onFeedScrollEnd = useCallback(
    async (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!feedHeight) return;

      const nextIndex = Math.round(event.nativeEvent.contentOffset.y / feedHeight);
      const previousIndex = currentCardIndex;
      const minAllowedIndex = Math.max(0, previousIndex - 5);
      if (nextIndex < minAllowedIndex) {
        feedListRef.current?.scrollToIndex({ index: minAllowedIndex, animated: true });
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
          const message =
            error instanceof Error ? error.message : "Failed to auto-skip item";
          setBootstrapError(message);
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
        try {
          await loadMoreFeedItems();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to load next item";
          setBootstrapError(message);
        }
      }
    },
    [api, currentCardIndex, feedHeight, feedItems, feedLoading, loadMoreFeedItems, logFeedEvent]
  );

  const renderFeedItem = useCallback(
    ({ item }: { item: QueueItemDto }) => (
      <View style={{ height: feedHeight }} className="w-full py-2">
        <ProductCard
          item={item}
          interactionInFlight={interactionInFlight}
          activeInteractionType={
            interactionInFlight && feedItems[currentCardIndex]?.id === item.id
              ? activeInteractionType
              : null
          }
          appliedInteractionType={interactionByItemId[item.id] ?? null}
          onInteraction={submitInteraction}
        />
      </View>
    ),
    [
      activeInteractionType,
      feedHeight,
      interactionInFlight,
      submitInteraction,
    ]
  );

  useEffect(() => {
    return () => {
      if (actionMessageTimeoutRef.current) {
        clearTimeout(actionMessageTimeoutRef.current);
      }
    };
  }, []);

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
    }, [api])
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ThemedView className="w-full h-full bg-white">
        <View className="w-full flex-row h-16 flex justify-between items-center p-4">
          <Pressable
            className="flex-row justify-center items-end gap-1"
            onPress={() => bottomSheetRef.current?.snapToIndex(0)}
          >
            <Text className="text-lg font-noto-serif-bold">{activeFeedName}</Text>
            <ChevronDown size={24} color="black" strokeWidth={1.5} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/feed/settings")}
            accessibilityRole="button"
            accessibilityLabel="Feed settings"
            hitSlop={8}
          >
            <SlidersHorizontal size={30} color="black" strokeWidth={1.5} />
          </Pressable>
        </View>
        <View className="px-4 pb-2 h-12">
          {actionMessage ? (
            <View className="rounded-md bg-zinc-100 px-3 py-2">
              <Text className="text-sm text-zinc-700">{actionMessage}</Text>
            </View>
          ) : (
            <View className="rounded-md px-3 py-2 opacity-0">
              <Text className="text-sm">placeholder</Text>
            </View>
          )}
        </View>
        {bootstrapError ? (
          <View className="px-4 pb-2">
            <Text className="text-sm text-red-600">{bootstrapError}</Text>
          </View>
        ) : null}
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
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                />
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
          {feedLoading ? (
            <View className="px-3 pb-2">
              <Text className="text-sm text-zinc-600">Loading next recommendation...</Text>
            </View>
          ) : null}
          <LinearGradient
            colors={["rgba(0,0,0,0.15)", "transparent"]}
            className="absolute left-0 right-0 top-0 h-3"
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.15)"]}
            className="absolute left-0 right-0 bottom-0 h-3"
            pointerEvents="none"
          />
        </View>
        <View className="w-full flex-row items-center px-2 pt-2 pb-1">
          <Pressable
            className="flex-1 items-center py-1"
            accessibilityRole="button"
            accessibilityLabel="Home"
            hitSlop={12}
            onPress={() => {
              if (feedItems.length > 0 && feedHeight > 0) {
                feedListRef.current?.scrollToIndex({ index: 0, animated: true });
                setCurrentCardIndex(0);
              }
            }}
          >
            <House size={22} color="black" strokeWidth={1.5} />
          </Pressable>
          <Link href="/bookmarks" asChild>
            <Pressable
              className="flex-1 items-center py-1"
              accessibilityRole="button"
              accessibilityLabel="Saved items"
              hitSlop={12}
            >
              <Bookmark size={22} color="black" strokeWidth={1.5} />
            </Pressable>
          </Link>
          <Link href="/profile" asChild>
            <Pressable
              className="flex-1 items-center py-1"
              accessibilityRole="button"
              accessibilityLabel="Profile"
              hitSlop={12}
            >
              <CircleUserRound size={22} color="black" strokeWidth={1.5} />
            </Pressable>
          </Link>
        </View>
      </ThemedView>
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        topInset={insets.top}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: "#fff" }}
        handleIndicatorStyle={{ backgroundColor: "#ccc" }}
      >
        <BottomSheetView className="flex-1 p-4">
          <ThemedText fontStyle="serif" fontWeight="bold" className="text-lg">
            Switch Feed
          </ThemedText>
          <ThemedText className="mt-2 text-zinc-500">
            Choose a person/feed to view different recommendations.
          </ThemedText>
          <View className="mt-4 gap-2">
            {availableFeeds.map((feed) => {
              const isActive = feed.name === activeFeedName;
              return (
                <Pressable
                  key={feed.id}
                  className="rounded-md border px-3 py-3"
                  style={{
                    borderColor: isActive ? "#1f7a5c" : "#d4d4d8",
                    backgroundColor: isActive ? "rgba(31,122,92,0.08)" : "white",
                  }}
                  onPress={() => switchToFeed(feed)}
                >
                  <Text className="text-base text-zinc-900">{feed.name}</Text>
                  <Text className="text-xs text-zinc-500">
                    Profile {isActive ? "• Current" : ""}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              className="mt-3 rounded-md bg-black px-3 py-3"
              onPress={() => {
                bottomSheetRef.current?.close();
                router.push("/feed/new");
              }}
            >
              <Text className="text-center text-white">Add feed</Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}
