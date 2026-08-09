import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { Check, ChevronDown, MoreVertical } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/ui/toast";
import { getApiClient } from "@/lib/api";
import { loadProfilesForUser, startSessionForProfile } from "@/lib/api/bootstrap";
import type { FeedDto } from "@/lib/api/client";
import { savedItemToBookmarkItem, type BookmarkItemDto } from "@/lib/api/mappers";
import { getCurrentFeedId, getCurrentUserId } from "@/lib/state/user-context";

function formatPrice(item: BookmarkItemDto): string {
  if (item.priceCents == null || !item.currency) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: item.currency,
  }).format(item.priceCents / 100);
}

function formatSavedAt(savedAt: string | null): string | null {
  if (!savedAt) return null;
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SavedItemRow({
  item,
  onOpenMenu,
}: {
  item: BookmarkItemDto;
  onOpenMenu: (item: BookmarkItemDto) => void;
}) {
  const savedLabel = formatSavedAt(item.savedAt);

  return (
    <View className="flex-row gap-3 rounded-xl border border-zinc-200 bg-white p-3">
      <Pressable
        className="flex-1 flex-row gap-3 active:opacity-80"
        onPress={() => {
          if (item.buyUrl) Linking.openURL(item.buyUrl);
        }}
        disabled={!item.buyUrl}
      >
        <View className="h-24 w-24 overflow-hidden rounded-lg bg-zinc-100">
          {item.imageUrl ? (
            <Image
              source={item.imageUrl}
              style={{ width: 96, height: 96 }}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-xs text-zinc-400">No image</Text>
            </View>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-noto-serif-bold text-base text-zinc-900" numberOfLines={3}>
            {item.title}
          </Text>
          <Text className="mt-1 text-sm text-zinc-600">{formatPrice(item)}</Text>
          {savedLabel ? (
            <Text className="mt-1 text-xs text-zinc-400">Saved {savedLabel}</Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        onPress={() => onOpenMenu(item)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Bookmark actions"
        className="h-9 w-9 items-center justify-center rounded-full active:bg-zinc-100"
      >
        <MoreVertical size={20} color="#3f3f46" strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

export default function BookmarksScreen() {
  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();

  const [items, setItems] = useState<BookmarkItemDto[]>([]);
  const [feeds, setFeeds] = useState<FeedDto[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(
    () => getCurrentFeedId()
  );
  const [feedName, setFeedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingFeed, setSwitchingFeed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<BookmarkItemDto | null>(null);
  const [feedPickerOpen, setFeedPickerOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const otherFeeds = useMemo(
    () => feeds.filter((feed) => feed.id !== selectedFeedId),
    [feeds, selectedFeedId]
  );

  const loadSavedItems = useCallback(async (isRefresh = false, profileIdOverride?: string) => {
    const profileId = profileIdOverride ?? getCurrentFeedId();
    const userId = getCurrentUserId();
    if (!profileId) {
      setItems([]);
      setFeeds([]);
      setSelectedFeedId(null);
      setFeedName(null);
      setError("Set up a recipient first to start saving gifts.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [response, profiles] = await Promise.all([
        api.getSavedItems(profileId),
        userId ? loadProfilesForUser(api, userId) : Promise.resolve([]),
      ]);
      setItems(response.items.map(savedItemToBookmarkItem));
      setFeeds(profiles);
      setSelectedFeedId(profileId);
      setFeedName(profiles.find((feed) => feed.id === profileId)?.name ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load saved items.";
      setError(message);
      setItems([]);
      setFeeds([]);
      setFeedName(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      loadSavedItems();
    }, [loadSavedItems])
  );

  const switchFeed = useCallback(
    async (feed: FeedDto) => {
      if (feed.id === selectedFeedId || switchingFeed) {
        setFeedPickerOpen(false);
        return;
      }

      setFeedPickerOpen(false);
      setMenuItem(null);
      setSwitchingFeed(true);
      setLoading(true);
      setError(null);

      try {
        await startSessionForProfile(api, feed.id);
        setSelectedFeedId(feed.id);
        setFeedName(feed.name);
        const response = await api.getSavedItems(feed.id);
        setItems(response.items.map(savedItemToBookmarkItem));
      } catch (err) {
        toast.show({
          message: err instanceof Error ? err.message : "Couldn’t switch feeds.",
          variant: "error",
        });
        await loadSavedItems();
      } finally {
        setSwitchingFeed(false);
        setLoading(false);
      }
    },
    [api, loadSavedItems, selectedFeedId, switchingFeed, toast]
  );

  const closeMenu = useCallback(() => {
    if (actionBusy) return;
    setMenuItem(null);
  }, [actionBusy]);

  const handleCopyToFeed = useCallback(
    async (targetFeed: FeedDto) => {
      if (!selectedFeedId || !menuItem || actionBusy) return;

      setActionBusy(true);
      try {
        const result = await api.copySavedItem(selectedFeedId, menuItem.id, targetFeed.id);
        setMenuItem(null);
        toast.show({
          message: result.already_saved
            ? `Already on ${targetFeed.name}'s list`
            : `Copied to ${targetFeed.name}'s list`,
          variant: result.already_saved ? "info" : "success",
        });
      } catch (err) {
        toast.show({
          message: err instanceof Error ? err.message : "Couldn’t copy that gift.",
          variant: "error",
        });
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, api, menuItem, selectedFeedId, toast]
  );

  const handleRemove = useCallback(async () => {
    if (!selectedFeedId || !menuItem || actionBusy) return;

    const removingId = menuItem.id;
    setActionBusy(true);
    try {
      await api.unsaveItem(selectedFeedId, removingId);
      setItems((prev) => prev.filter((item) => item.id !== removingId));
      setMenuItem(null);
      toast.show({ message: "Removed from saved", variant: "info" });
    } catch (err) {
      toast.show({
        message: err instanceof Error ? err.message : "Couldn’t remove that gift.",
        variant: "error",
      });
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, api, menuItem, selectedFeedId, toast]);

  const headerTitle = feedName ? `${feedName}'s saved gifts` : "Bookmarked Items";
  const headerSubtitle = feedName
    ? `Gifts you bookmarked while browsing ${feedName}'s feed`
    : "Saved products for the currently selected feed.";

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-1 px-4">
        <View className="flex-row items-start justify-between gap-3 pb-3 pt-2">
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-noto-serif-bold">{headerTitle}</Text>
            <Text className="mt-1 text-sm text-zinc-600">{headerSubtitle}</Text>
          </View>
          {feeds.length > 0 ? (
            <Pressable
              onPress={() => setFeedPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Switch feed"
              hitSlop={8}
              className="mt-0.5 max-w-[42%] flex-row items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 active:bg-zinc-100"
            >
              <Text
                className="shrink font-sf-display-semibold text-sm text-zinc-900"
                numberOfLines={1}
              >
                {feedName ?? "Switch"}
              </Text>
              <ChevronDown size={16} color="#3f3f46" strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-zinc-500">
              {switchingFeed ? "Switching feeds…" : "Loading saved items…"}
            </Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View className="rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm text-red-800">{error}</Text>
            <Pressable onPress={() => loadSavedItems()} className="mt-3 self-start">
              <Text className="text-sm font-medium text-red-900">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <View className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <Text className="text-sm font-medium text-zinc-900">Nothing saved yet</Text>
            <Text className="mt-2 text-sm text-zinc-600">
              {feedName
                ? `Tap the bookmark icon on a gift in ${feedName}'s feed to save it here.`
                : "Tap the bookmark icon on a gift card in your feed to save it here."}
            </Text>
          </View>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SavedItemRow item={item} onOpenMenu={setMenuItem} />
            )}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadSavedItems(true)}
              />
            }
          />
        ) : null}
      </View>

      <Modal
        visible={feedPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFeedPickerOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setFeedPickerOpen(false)}
        >
          <Pressable
            className="rounded-t-2xl bg-white px-4 pb-8 pt-3"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-3 items-center">
              <View className="h-1 w-10 rounded-full bg-zinc-300" />
            </View>
            <Text className="font-noto-serif-bold text-lg text-zinc-900">
              Whose saved gifts?
            </Text>
            <Text className="mt-1 mb-4 text-sm text-zinc-500">
              Switch feeds to see another person’s bookmarked items.
            </Text>

            <View className="gap-2.5">
              {feeds.map((feed) => {
                const isActive = feed.id === selectedFeedId;
                return (
                  <Pressable
                    key={feed.id}
                    disabled={switchingFeed}
                    onPress={() => switchFeed(feed)}
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
                      <Text className="mt-0.5 text-[13px] text-zinc-500">
                        {isActive ? "Currently viewing" : "View saved gifts"}
                      </Text>
                    </View>
                    {isActive ? (
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

            <Pressable
              onPress={() => setFeedPickerOpen(false)}
              className="mt-3 items-center py-3"
            >
              <Text className="text-sm font-medium text-zinc-600">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={menuItem != null}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={closeMenu}
        >
          <Pressable
            className="rounded-t-2xl bg-white px-4 pb-8 pt-3"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-3 items-center">
              <View className="h-1 w-10 rounded-full bg-zinc-300" />
            </View>
            <Text className="mb-1 font-noto-serif-bold text-base text-zinc-900" numberOfLines={2}>
              {menuItem?.title ?? "Saved gift"}
            </Text>
            <Text className="mb-4 text-sm text-zinc-500">
              Copy to another feed or remove from this list.
            </Text>

            {otherFeeds.length === 0 ? (
              <Text className="mb-3 text-sm text-zinc-500">
                Create another recipient feed to copy this gift there.
              </Text>
            ) : (
              otherFeeds.map((feed) => (
                <Pressable
                  key={feed.id}
                  disabled={actionBusy}
                  onPress={() => handleCopyToFeed(feed)}
                  className="mb-2 rounded-xl border border-zinc-200 px-4 py-3 active:bg-zinc-50"
                >
                  <Text className="text-sm font-medium text-zinc-900">
                    Copy to {feed.name}
                  </Text>
                </Pressable>
              ))
            )}

            <Pressable
              disabled={actionBusy}
              onPress={handleRemove}
              className="mt-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 active:bg-red-100"
            >
              <Text className="text-sm font-medium text-red-800">Remove from saved</Text>
            </Pressable>

            <Pressable
              disabled={actionBusy}
              onPress={closeMenu}
              className="mt-2 items-center py-3"
            >
              <Text className="text-sm font-medium text-zinc-600">Cancel</Text>
            </Pressable>

            {actionBusy ? (
              <View className="absolute inset-0 items-center justify-center rounded-t-2xl bg-white/70">
                <ActivityIndicator />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
