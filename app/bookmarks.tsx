import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ProductCardChip from "@/components/product-card/components/product-card-chip";
import { createGiftGeniusApiClient } from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import { savedItemToBookmarkItem, type BookmarkItemDto } from "@/lib/api/mappers";
import { getAccessToken, getCurrentFeedId } from "@/lib/state/user-context";

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

function SavedItemRow({ item }: { item: BookmarkItemDto }) {
  const savedLabel = formatSavedAt(item.savedAt);

  return (
    <Pressable
      className="flex-row gap-3 rounded-xl border border-zinc-200 bg-white p-3 active:bg-zinc-50"
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
        {item.tags.length > 0 ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {item.tags.slice(0, 2).map((tag) => (
              <ProductCardChip key={tag} label={tag} />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function BookmarksScreen() {
  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

  const [items, setItems] = useState<BookmarkItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSavedItems = useCallback(async (isRefresh = false) => {
    const profileId = getCurrentFeedId();
    if (!profileId) {
      setItems([]);
      setError("No active profile. Open the feed from the home screen first.");
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
      const response = await api.getSavedItems(profileId);
      setItems(response.items.map(savedItemToBookmarkItem));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load saved items.";
      setError(message);
      setItems([]);
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

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <View className="flex-1 px-4">
        <View className="pb-3 pt-2">
          <Text className="text-xl font-noto-serif-bold">Bookmarked Items</Text>
          <Text className="text-sm text-zinc-600">
            Saved products for the currently selected profile.
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-zinc-500">Loading saved items…</Text>
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
              Tap the bookmark icon on a gift card in your feed to save it here.
            </Text>
          </View>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <SavedItemRow item={item} />}
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
    </SafeAreaView>
  );
}
