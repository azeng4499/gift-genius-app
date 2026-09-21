import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { ThemedView } from "@/components/themed-view";
import { ChevronDown, Pencil, Plus, Ellipsis } from "lucide-react-native";

import ProductCard from "@/components/product-card/product-card";
import {
  SettingUpScreen,
  SwitchingFeedScreen,
  LoadingOverlay,
} from "@/components/feed/setting-up-screen";
import {
  SelectSheet,
  type SelectSheetItem,
  type SelectSheetRef,
} from "@/components/ui/select-sheet";
import { ActionSheet, type ActionSheetRef } from "@/components/ui/action-sheet";
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
  setCurrentProfile,
  setCurrentSession,
} from "@/lib/state/user-context";
import { peekQueuedFeedSwitch, takeQueuedFeedSwitch } from "@/lib/state/pending-feed-switch";
import { endTimeline, mark, startTimeline } from "@/lib/diag";

// A full batch. What the feed settles at, and what every load after the first
// asks for.
const FEED_BATCH_SIZE = Number(process.env.EXPO_PUBLIC_FEED_BATCH_SIZE ?? 10);

// The first batch after a switch or cold open. Deliberately small: the engine
// stops searching as soon as it can fill the request, so asking for fewer cards
// gets the first one on screen a whole Canopy round trip sooner. The rest is
// topped up in the background while the user reads.
const FEED_FIRST_BATCH_SIZE = Number(
  process.env.EXPO_PUBLIC_FEED_FIRST_BATCH_SIZE ?? 4,
);

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
  // Mirrors feedItems so async handlers can read the latest length (e.g. to tell
  // whether a new batch was appended) without capturing a stale closure.
  const feedItemsRef = useRef<QueueItemDto[]>([]);
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
  const feedMenuRef = useRef<ActionSheetRef>(null);
  const insets = useSafeAreaInsets();
  // Which profile the on-screen cards belong to. People/bookmarks can change
  // the active session while this tab is unfocused; we reload when they differ.
  const loadedProfileIdRef = useRef<string | null>(null);
  const feedEpochRef = useRef(0);
  const switchGenerationRef = useRef(0);
  const switchSourceRef = useRef<"people" | "home" | "focus">("home");
  // Which feed a switch is currently heading to, so a repeat request for the
  // same one can be ignored instead of starting a second competing switch.
  const switchTargetRef = useRef<string | null>(null);
  // Every feed load gets an id and each stage of its life is logged with the
  // epoch and generation it belongs to. Overlapping loads are what strand this
  // screen, and they are indistinguishable in the log without these.
  const feedLoadSeqRef = useRef(0);
  const inFlightLoadsRef = useRef<Set<number>>(new Set());
  // Guards the post-create refresh so it runs once per navigation, not once per
  // render of an effect whose callback deps change identity.
  const handledRefreshKeyRef = useRef<string | null>(null);
  const handledRefreshFeedKeyRef = useRef<string | null>(null);
  const previousFeedRef = useRef<{
    profileId: string | null;
    sessionId: string | null;
    items: QueueItemDto[];
    index: number;
    name: string;
    interactionByItemId: Record<string, AppliedInteraction>;
    loadedProfileId: string | null;
  } | null>(null);
  const feedViewRef = useRef({
    items: [] as QueueItemDto[],
    index: 0,
    name: "Your gifts",
    interactionByItemId: {} as Record<string, AppliedInteraction>,
  });
  const [feedSwitching, setFeedSwitching] = useState(false);
  const [switchingFeedName, setSwitchingFeedName] = useState("");
  const feedSwitchingRef = useRef(false);
  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();
  const navigation = useNavigation();

  const logLoad = useCallback(
    (event: string, details: Record<string, unknown> = {}) => {
      console.log("[FeedLoad]", event, {
        ...details,
        epoch: feedEpochRef.current,
        switchGeneration: switchGenerationRef.current,
        switchTarget: switchTargetRef.current,
        inFlightLoads: [...inFlightLoadsRef.current],
        loadedProfileId: loadedProfileIdRef.current,
        sessionId: getCurrentSessionId(),
        feedId: getCurrentFeedId(),
      });
    },
    [],
  );

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

  const loadMoreFeedItems = useCallback(async (size = FEED_BATCH_SIZE) => {
    const sessionId = getCurrentSessionId();
    if (!sessionId) {
      throw new Error("Your feed isn’t ready yet. Pull down to refresh.");
    }

    const epoch = feedEpochRef.current;
    const requestId = ++feedLoadSeqRef.current;
    logLoad("batch_request_start", { requestId, requestedSessionId: sessionId, size });
    setFeedLoading(true);
    try {
      const batch = await api.getFeedBatch(sessionId, size);
      if (epoch !== feedEpochRef.current) {
        // A newer load replaced us while this was in flight. Its items are the
        // ones on screen, so this response is dropped rather than appended.
        logLoad("batch_discarded_stale", {
          requestId,
          requestedSessionId: sessionId,
          startedAtEpoch: epoch,
          items: batch.items.length,
        });
        return { count: 0, preparing: false };
      }
      const mapped = batch.items.map(feedItemToQueueItem);
      logFeedEvent("load_feed_batch", {
        sessionId,
        count: mapped.length,
      });
      mark("GET /feed returned", {
        items: mapped.length,
        preparing: batch.preparing ?? false,
        serverMs: batch.diag?.total_ms,
        // Where the server spent it, so client and server views sit together.
        serverPhases: batch.diag?.phases
          ?.map((p) => `${p.label} ${p.ms}ms`)
          .join(", "),
        serverExternal: batch.diag?.external
          ?.map((e) => `${e.target} ×${e.calls} ${e.total_ms}ms`)
          .join(", "),
        serverCounters: batch.diag?.counters,
      });
      setFeedItems((prev) => {
        if (epoch !== feedEpochRef.current) return prev;
        const seen = new Set(prev.map((item) => item.id));
        const fresh = mapped.filter((item) => !seen.has(item.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
      return { count: mapped.length, preparing: batch.preparing ?? false };
    } finally {
      if (epoch === feedEpochRef.current) setFeedLoading(false);
    }
  }, [api, logFeedEvent, logLoad]);

  // Fill the feed out to a normal batch after the first few cards are on screen,
  // so the short first batch doesn't turn into a wait at card four. Silent by
  // design: the user is already reading, and a failure here just means the
  // scroll-triggered load picks it up.
  const topUpFeedInBackground = useCallback(
    (epoch: number) => {
      if (feedItemsRef.current.length >= FEED_BATCH_SIZE) return;
      void (async () => {
        if (epoch !== feedEpochRef.current) return;
        try {
          const { count } = await loadMoreFeedItems(FEED_BATCH_SIZE);
          logLoad("background_top_up", { added: count });
        } catch (error) {
          logLoad("background_top_up_failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    },
    [loadMoreFeedItems, logLoad],
  );

  // Runs a feed load behind the "loading" overlay, and flips to the error overlay
  // if the load throws. The overlay is held for a short minimum so it reads as a
  // deliberate transition rather than a flicker; it used to be 5s, which made
  // every load feel that slow no matter how fast the batch actually arrived.
  // Tune with EXPO_PUBLIC_FEED_LOADING_MS.
  const runFeedLoad = useCallback(async (task: () => Promise<void>) => {
    const FEED_LOADING_MS = Number(
      process.env.EXPO_PUBLIC_FEED_LOADING_MS ?? 600,
    );
    setFeedError(null);
    setFeedStatus("loading");
    const startedAt = Date.now();
    try {
      await task();
      const taskMs = Date.now() - startedAt;
      const remaining = FEED_LOADING_MS - taskMs;
      if (remaining > 0) {
        mark("artificial loading-overlay padding", {
          actualLoadMs: taskMs,
          paddedByMs: remaining,
          floorMs: FEED_LOADING_MS,
        });
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
    // Poll quickly at first, then ease off. The backend prepares a new feed in
    // waves, so the first items often exist well before a fixed 4s tick would
    // have asked; the backoff keeps a long wait from hammering the API.
    const FIRST_DELAY_MS = 500;
    const MAX_INTERVAL_MS = 4000;
    let intervalMs = 1000;
    let attempt = 0;

    const tick = async () => {
      if (token !== pollTokenRef.current) return;
      attempt += 1;
      try {
        // Same reasoning as the first load: ask for the few cards needed to start
        // reading, not a full batch the engine has to keep searching for.
        const { count, preparing } = await loadMoreFeedItems(FEED_FIRST_BATCH_SIZE);
        if (token !== pollTokenRef.current) return;
        if (count > 0) {
          mark(`poll attempt ${attempt}: got items`, {
            waitedMs: Date.now() - startedAt,
          });
          setFeedPreparing(false);
          endTimeline("cards ready after polling", { attempts: attempt, items: count });
          topUpFeedInBackground(feedEpochRef.current);
          return;
        }
        // Backend finished computing but there's nothing to show.
        if (!preparing) {
          mark(`poll attempt ${attempt}: backend done, feed empty`, {
            waitedMs: Date.now() - startedAt,
          });
          setFeedPreparing(false);
          endTimeline("empty feed after polling", { attempts: attempt });
          return;
        }
        mark(`poll attempt ${attempt}: still preparing, waiting ${intervalMs}ms`);
      } catch {
        if (token !== pollTokenRef.current) return;
        mark(`poll attempt ${attempt}: failed, retrying in ${intervalMs}ms`);
        // Transient error — keep retrying until the max wait.
      }
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        mark("polling gave up at max wait", { waitedMs: Date.now() - startedAt });
        setFeedPreparing(false);
        endTimeline("gave up", { attempts: attempt });
        return;
      }
      const delay = intervalMs;
      intervalMs = Math.min(Math.round(intervalMs * 1.5), MAX_INTERVAL_MS);
      setTimeout(tick, delay);
    };

    mark(`polling started, first attempt in ${FIRST_DELAY_MS}ms`);
    setTimeout(tick, FIRST_DELAY_MS);
  }, [loadMoreFeedItems, topUpFeedInBackground]);

  useEffect(() => stopFeedPolling, [stopFeedPolling]);

  const resetAndLoadFeedCards = useCallback(async (): Promise<void> => {
    const epoch = feedEpochRef.current;
    const loadId = ++feedLoadSeqRef.current;
    inFlightLoadsRef.current.add(loadId);
    logLoad("load_start", { loadId, clearedCards: true });

    stopFeedPolling();
    setFeedItems([]);
    setCurrentCardIndex(0);
    interactedItemIdsRef.current.clear();
    setInteractionByItemId({});
    setFeedPreparing(true);

    // This load emptied the screen and turned the spinner on, so it has to leave
    // one of those two undone. Bailing out silently is what left the feed
    // spinning forever with no card and no pending request.
    const releaseLoad = (outcome: string, details: Record<string, unknown> = {}) => {
      inFlightLoadsRef.current.delete(loadId);
      const superseded = epoch !== feedEpochRef.current;
      const abandoned = superseded && inFlightLoadsRef.current.size === 0;
      logLoad(`load_${outcome}`, { loadId, superseded, abandoned, ...details });
      if (abandoned) {
        // Superseded, but whatever replaced us is no longer running either, so
        // nobody is going to fill the screen we just cleared.
        setFeedPreparing(false);
        endTimeline("abandoned load recovered", { loadId });
      }
    };

    try {
      // A first batch of ten waits for the engine to find ten fillable cards,
      // which on a cold feed is a second round of Canopy searches. Asking for a
      // few gets the user reading sooner; the rest is topped up behind them.
      const { count, preparing } = await loadMoreFeedItems(FEED_FIRST_BATCH_SIZE);
      if (epoch !== feedEpochRef.current) {
        releaseLoad("superseded", { items: count });
        return;
      }
      if (count > 0) {
        setFeedPreparing(false);
        endTimeline("cards ready", { items: count });
        topUpFeedInBackground(epoch);
      } else if (preparing) {
        // Empty but still being computed for the first time — poll until items
        // arrive instead of dead-ending on an empty state.
        startFeedPolling();
      } else {
        // Genuinely empty feed.
        setFeedPreparing(false);
        endTimeline("empty feed");
      }
      loadedProfileIdRef.current = getCurrentFeedId();
      releaseLoad("done", { items: count, preparing });
    } catch (error) {
      if (epoch !== feedEpochRef.current) {
        releaseLoad("superseded_after_error", {
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      setFeedPreparing(false);
      endTimeline("failed");
      releaseLoad("failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (isFeedQueueEmptyError(error)) {
        loadedProfileIdRef.current = getCurrentFeedId();
        return;
      }
      throw error;
    }
  }, [
    loadMoreFeedItems,
    logLoad,
    startFeedPolling,
    stopFeedPolling,
    topUpFeedInBackground,
  ]);

  const restorePreviousFeed = useCallback(() => {
    const snapshot = previousFeedRef.current;
    if (!snapshot) return;
    logLoad("restore_previous_feed", {
      restoringProfileId: snapshot.profileId,
      restoringSessionId: snapshot.sessionId,
      restoringItems: snapshot.items.length,
    });
    setCurrentProfile(snapshot.profileId);
    setCurrentSession(snapshot.sessionId);
    setFeedItems(snapshot.items);
    setCurrentCardIndex(snapshot.index);
    setActiveFeedName(snapshot.name);
    setInteractionByItemId(snapshot.interactionByItemId);
    loadedProfileIdRef.current = snapshot.loadedProfileId;
    setFeedPreparing(snapshot.items.length === 0);
    setFeedStatus("ready");
    setFeedError(null);
  }, [logLoad]);

  const switchToFeed = useCallback(
    async (
      feed: FeedDto,
      source: "people" | "home" | "focus" = "home",
      options?: { notify?: boolean },
    ) => {
      if (feed.id === loadedProfileIdRef.current && !feedSwitchingRef.current) {
        bottomSheetRef.current?.dismiss();
        return;
      }

      // Already on our way to this same feed. Several triggers can ask for the
      // same switch (post-create redirect, focus effect, the switcher sheet),
      // and starting a second one just races two sessions against each other.
      if (feedSwitchingRef.current && switchTargetRef.current === feed.id) {
        logLoad("switch_ignored_duplicate", { feedId: feed.id, source });
        bottomSheetRef.current?.dismiss();
        return;
      }

      const generation = ++switchGenerationRef.current;
      switchTargetRef.current = feed.id;
      feedEpochRef.current += 1;
      switchSourceRef.current = source;
      previousFeedRef.current = {
        profileId: getCurrentFeedId(),
        sessionId: getCurrentSessionId(),
        items: feedViewRef.current.items,
        index: feedViewRef.current.index,
        name: feedViewRef.current.name,
        interactionByItemId: feedViewRef.current.interactionByItemId,
        loadedProfileId: loadedProfileIdRef.current,
      };

      feedSwitchingRef.current = true;
      setSwitchingFeedName(feed.name);
      setActiveFeedName(feed.name);
      setFeedSwitching(true);
      bottomSheetRef.current?.dismiss();
      startTimeline("switch feed → first card", { feed: feed.name, source });
      logLoad("switch_start", { generation, feedId: feed.id, feedName: feed.name, source });

      try {
        const session = await api.createSession(feed.id);
        mark("POST /sessions returned");
        if (generation !== switchGenerationRef.current) {
          logLoad("switch_superseded_before_load", {
            generation,
            attemptedFeedId: feed.id,
            discardedSessionId: session.id,
          });
          return;
        }
        setCurrentSession(session.id);
        setCurrentProfile(feed.id);
        logFeedEvent("feed_switch", {
          nextProfileId: feed.id,
          nextProfileName: feed.name,
        });
        await resetAndLoadFeedCards();
        if (generation !== switchGenerationRef.current) {
          // A newer switch owns the screen now. Restoring our snapshot here
          // would overwrite its freshly loaded cards with whatever was showing
          // before us — and when that snapshot is empty (a fresh mount), it
          // blanks the feed and leaves it preparing with nothing in flight.
          logLoad("switch_superseded_discarded", {
            generation,
            attemptedFeedId: feed.id,
          });
          return;
        }
        loadedProfileIdRef.current = feed.id;
        if (options?.notify !== false) {
          toast.show({
            message: `Now shopping for ${feed.name}`,
            variant: "success",
          });
        }
      } catch (error) {
        if (generation !== switchGenerationRef.current) return;
        restorePreviousFeed();
        toast.show({ message: friendlyErrorMessage(error), variant: "error" });
      } finally {
        if (generation === switchGenerationRef.current) {
          feedSwitchingRef.current = false;
          setFeedSwitching(false);
          switchTargetRef.current = null;
        }
      }
    },
    [api, logFeedEvent, logLoad, resetAndLoadFeedCards, restorePreviousFeed, toast],
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
    feedViewRef.current = {
      items: feedItems,
      index: currentCardIndex,
      name: activeFeedName,
      interactionByItemId,
    };
  }, [activeFeedName, currentCardIndex, feedItems, interactionByItemId]);

  useEffect(() => {
    const selectedProfileId = params.selectedFeedId?.trim();
    if (!params.refreshKey || !selectedProfileId) {
      return;
    }

    // Run once per refreshKey. `switchToFeed` and `toast` change identity on
    // render, so without this the effect re-fires with unchanged params and
    // starts a second switch to the same feed.
    const handledKey = `${params.refreshKey}:${selectedProfileId}`;
    if (handledRefreshKeyRef.current === handledKey) return;
    handledRefreshKeyRef.current = handledKey;

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
          await switchToFeed(selectedProfile, "home", { notify: false });
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
    // Once per key, for the same reason as the post-create refresh above.
    if (handledRefreshFeedKeyRef.current === params.refreshFeedKey) return;
    handledRefreshFeedKeyRef.current = params.refreshFeedKey;

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
    const isAtEnd = currentCardIndex >= feedItems.length - 1;
    if (isAtEnd) {
      // End of the feed — show the loading overlay while the next batch loads,
      // then land on the first card of that batch (only if it actually grew).
      const firstNewIndex = feedItemsRef.current.length;
      await runFeedLoad(async () => {
        await loadMoreFeedItems();
      });
      if (feedItemsRef.current.length > firstNewIndex) {
        setCurrentCardIndex(firstNewIndex);
        setPendingScrollIndex(firstNewIndex);
      }
      return;
    }
    const nextIndex = currentCardIndex + 1;
    setCurrentCardIndex(nextIndex);
    feedListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
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
    startTimeline("cold open → first card", { clerkUserId: user.id });

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
      startTimeline("pull-to-refresh → first card");
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

      // Only load the next batch once the user swipes *while already on* the last
      // prepared card (a forward overscroll that stays on it) — not merely when
      // they arrive at it — so they get to see and swipe that last card first.
      // The overlay fires immediately here, before the skip signals below. When
      // the batch lands, jump to its first card instead of the old last card.
      const lastIndex = feedItems.length - 1;
      if (
        previousIndex >= lastIndex &&
        nextIndex >= lastIndex &&
        !feedLoading
      ) {
        const firstNewIndex = feedItemsRef.current.length;
        runFeedLoad(async () => {
          await loadMoreFeedItems();
        }).then(() => {
          if (feedItemsRef.current.length > firstNewIndex) {
            setCurrentCardIndex(firstNewIndex);
            setPendingScrollIndex(firstNewIndex);
          }
        });
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
    feedItemsRef.current = feedItems;
  }, [feedItems]);

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
      if (!userId) return;
      if (feedSwitchingRef.current) return;

      let cancelled = false;
      (async () => {
        try {
          const queued = peekQueuedFeedSwitch();
          const profiles = await loadProfilesForUser(api, userId);
          if (cancelled || feedSwitchingRef.current) return;
          setAvailableFeeds(profiles);

          if (queued) {
            takeQueuedFeedSwitch();
            const selected = profiles.find((feed) => feed.id === queued.feedId);
            if (selected) {
              await switchToFeed(selected, queued.source);
            }
            return;
          }

          const profileId = getCurrentFeedId();
          if (!profileId) return;
          const current = profiles.find((f) => f.id === profileId);
          if (current) {
            setActiveFeedName(current.name);
          }
          if (
            current &&
            loadedProfileIdRef.current &&
            loadedProfileIdRef.current !== profileId
          ) {
            await switchToFeed(current, "focus");
          }
        } catch {
          /* keep existing header if refresh fails */
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [api, switchToFeed]),
  );

  if (bootstrapping) {
    return <SettingUpScreen />;
  }

  if (feedSwitching) {
    return (
      <SwitchingFeedScreen name={switchingFeedName || activeFeedName} />
    );
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Feed options"
              hitSlop={8}
              onPress={() => feedMenuRef.current?.present()}
            >
              <Ellipsis size={24} color="black" />
            </Pressable>
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
              <LoadingOverlay
                title={`Finding gifts for ${activeFeedName}`}
                subtitle="Hand-picking ideas they’ll love."
              />
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
            <LoadingOverlay
              title="Finding more gifts"
              subtitle="Fresh ideas, coming up."
            />
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

      <ActionSheet ref={feedMenuRef}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 16 + insets.bottom,
          }}
        >
          <View>
            <Text
              className="text-left text-xl text-slate-700"
              fontStyle="noto-serif-bold"
              numberOfLines={1}
            >
              {activeFeedName}
            </Text>
            <Text
              className="px-1 pb-6 pt-1 text-left"
              fontStyle="sf-display-light"
            >
              Manage this feed.
            </Text>
          </View>

          <View className="gap-2.5">
            <Pressable
              onPress={() => {
                feedMenuRef.current?.dismiss();
                router.push({
                  pathname: "/feed/edit",
                  params: selectedFeedId ? { feedId: selectedFeedId } : {},
                });
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
          </View>
        </View>
      </ActionSheet>
    </SafeAreaView>
  );
}
