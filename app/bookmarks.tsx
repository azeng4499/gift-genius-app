import { useCallback } from "react";
import { Pressable, SafeAreaView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

export default function BookmarksScreen() {
  const loadSavedItems = useCallback(async () => {
    // GET /saved is not implemented on the new backend yet.
    // Saved items are feed_events where signal = 'save' server-side.
  }, []);

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
            Saved products for the currently selected profile.
          </Text>
        </View>

        <View className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <Text className="text-sm font-medium text-zinc-900">Coming soon</Text>
          <Text className="mt-2 text-sm text-zinc-600">
            The new backend records saves via POST /feed/signal, but a list
            endpoint (GET /saved) is not shipped yet. Your saves are stored on
            the server — this screen will populate once that route lands.
          </Text>
        </View>

        <Pressable
          className="mt-4 rounded-md border border-zinc-300 px-3 py-2"
          onPress={loadSavedItems}
        >
          <Text className="text-center text-zinc-700">Refresh</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
