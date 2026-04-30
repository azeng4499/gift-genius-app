import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, Text, View } from "react-native";

import { createGiftGeniusApiClient, type QueueItemDto } from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import {
  getAccessToken,
  getCurrentFeedId,
  getCurrentUserId,
} from "@/lib/state/user-context";

type InteractionType = "like" | "pass" | "save";

export default function FeedLoopTestScreen() {
  const [result, setResult] = useState<string>(
    "Run bootstrap first, then fetch next and interact"
  );
  const [currentItem, setCurrentItem] = useState<QueueItemDto | null>(null);
  const [queueRemaining, setQueueRemaining] = useState<number | null>(null);
  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getUserId: () => getCurrentUserId(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

  const runGetNext = async () => {
    const feedId = getCurrentFeedId();
    if (!feedId) {
      setResult("FAILED: no feed in context. Run bootstrap task first.");
      return;
    }

    setResult("Loading next item...");
    try {
      const next = await api.getNext(feedId);
      setCurrentItem(next.item);
      setQueueRemaining(next.queueRemaining);
      setResult(`OK: fetched item ${next.item.id} (${next.item.title})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResult(`FAILED: ${message}`);
    }
  };

  const runInteraction = async (type: InteractionType) => {
    const feedId = getCurrentFeedId();
    if (!feedId || !currentItem) {
      setResult("FAILED: fetch an item first.");
      return;
    }

    setResult(`Posting interaction: ${type}...`);
    try {
      await api.postInteraction(feedId, {
        catalogItemId: currentItem.id,
        type,
      });
      setResult(`OK: interaction recorded (${type})`);
      await runGetNext();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResult(`FAILED: ${message}`);
    }
  };

  const runGetSaved = async () => {
    const feedId = getCurrentFeedId();
    if (!feedId) {
      setResult("FAILED: no feed in context. Run bootstrap task first.");
      return;
    }

    setResult("Loading saved items...");
    try {
      const items = await api.getSaved(feedId);
      setResult(`OK: saved count = ${items.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResult(`FAILED: ${message}`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 p-4">
        <Text className="text-sm text-zinc-700">
          userId={String(getCurrentUserId())}, feedId={String(getCurrentFeedId())},
          token={getAccessToken() ? "present" : "missing"}
        </Text>

        <Pressable className="rounded-md bg-black px-4 py-3" onPress={runGetNext}>
          <Text className="text-center text-white">Fetch next card</Text>
        </Pressable>

        <View className="flex-row gap-2">
          <Pressable className="flex-1 rounded-md border border-zinc-300 px-3 py-2" onPress={() => runInteraction("like")}>
            <Text className="text-center text-zinc-700">Like</Text>
          </Pressable>
          <Pressable className="flex-1 rounded-md border border-zinc-300 px-3 py-2" onPress={() => runInteraction("pass")}>
            <Text className="text-center text-zinc-700">Pass</Text>
          </Pressable>
          <Pressable className="flex-1 rounded-md border border-zinc-300 px-3 py-2" onPress={() => runInteraction("save")}>
            <Text className="text-center text-zinc-700">Save</Text>
          </Pressable>
        </View>

        <Pressable className="rounded-md border border-zinc-300 px-4 py-3" onPress={runGetSaved}>
          <Text className="text-center text-zinc-700">Get saved items</Text>
        </Pressable>

        <Text className="text-sm text-zinc-700">{result}</Text>
        {currentItem ? (
          <Text className="text-sm text-zinc-700">
            Current item: #{currentItem.id} {currentItem.title} (queueRemaining=
            {String(queueRemaining)})
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
