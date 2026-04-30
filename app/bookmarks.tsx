import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, SafeAreaView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { createGiftGeniusApiClient, type QueueItemDto } from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import {
  getAccessToken,
  getCurrentFeedId,
  getCurrentUserId,
} from "@/lib/state/user-context";

function formatPrice(priceCents: number | null, currency: string | null) {
  if (priceCents == null || !currency) return "Price unavailable";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(priceCents / 100);
  } catch {
    return `${(priceCents / 100).toFixed(2)} ${currency}`;
  }
}

export default function BookmarksScreen() {
  const [items, setItems] = useState<QueueItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getUserId: () => getCurrentUserId(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

  const loadSavedItems = useCallback(async () => {
    const feedId = getCurrentFeedId();
    if (!feedId) {
      setError("No active feed selected.");
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const saved = await api.getSaved(feedId);
      setItems(saved);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load bookmarks.";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      loadSavedItems();
    }, [loadSavedItems])
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-4">
        <View className="mb-3">
          <Text className="text-xl font-noto-serif-bold">Bookmarked Items</Text>
          <Text className="text-sm text-zinc-600">
            Saved products for the currently selected feed.
          </Text>
        </View>

        <Pressable
          className="mb-3 rounded-md border border-zinc-300 px-3 py-2"
          onPress={loadSavedItems}
          disabled={loading}
        >
          <Text className="text-center text-zinc-700">
            {loading ? "Refreshing..." : "Refresh"}
          </Text>
        </Pressable>

        {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}

        <FlatList
          data={items}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          ListEmptyComponent={
            <Text className="text-sm text-zinc-500">
              {loading ? "Loading saved items..." : "No bookmarked items yet."}
            </Text>
          }
          renderItem={({ item }) => (
            <View className="mb-2 rounded-md border border-zinc-200 p-3">
              <Text className="text-sm text-zinc-900">{item.title}</Text>
              <Text className="mt-1 text-sm text-zinc-600">
                {formatPrice(item.priceCents, item.currency)}
              </Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
