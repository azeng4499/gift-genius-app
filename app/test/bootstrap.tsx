import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, Text, View } from "react-native";

import {
  createGiftGeniusApiClient,
  type FeedDto,
  type UserDto,
} from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import {
  clearUserContext,
  setAccessToken,
  getUserContext,
  setCurrentFeed,
  setCurrentUser,
} from "@/lib/state/user-context";

export default function BootstrapTestScreen() {
  const [result, setResult] = useState<string>("Tap run to create/select user and feed");
  const [contextResult, setContextResult] = useState<string>(
    JSON.stringify(getUserContext())
  );
  const api = useMemo(
    () => createGiftGeniusApiClient({ baseUrl: getGiftGeniusApiBaseUrl() }),
    []
  );

  const runBootstrap = async () => {
    setResult("Running...");
    try {
      let selectedUser: UserDto;
      const users = await api.getUsers();
      const userWithEmail = users.find((user) => !!user.email);
      if (userWithEmail) {
        selectedUser = userWithEmail;
      } else {
        selectedUser = await api.createUser({
          name: "GiftGenius Demo User",
          email: "demo.user@giftgenius.local",
        });
      }

      setCurrentUser(selectedUser.id);
      if (!selectedUser.email) {
        throw new Error("Selected user is missing email and cannot log in.");
      }
      const login = await api.loginWithEmail(selectedUser.email);
      setAccessToken(login.accessToken);

      let selectedFeed: FeedDto;
      const feeds = await api.getFeeds(selectedUser.id);
      if (feeds.length > 0) {
        selectedFeed = feeds[0];
      } else {
        selectedFeed = await api.createFeed({
          userId: selectedUser.id,
          name: "Default Feed",
          relationship: "friend",
          interests: ["gifts", "tech"],
          budgetMin: 25,
          budgetMax: 100,
        });
      }

      setCurrentFeed(selectedFeed.id);
      setContextResult(JSON.stringify(getUserContext()));
      setResult(
        `OK: user=${selectedUser.id} (${selectedUser.name}), feed=${selectedFeed.id} (${selectedFeed.name}), token=present`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResult(`FAILED: ${message}`);
    }
  };

  const resetContext = () => {
    clearUserContext();
    setContextResult(JSON.stringify(getUserContext()));
    setResult("Context reset");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 p-4">
        <Pressable className="rounded-md bg-black px-4 py-3" onPress={runBootstrap}>
          <Text className="text-center text-white">Run user/feed bootstrap</Text>
        </Pressable>
        <Pressable className="rounded-md border border-zinc-300 px-4 py-3" onPress={resetContext}>
          <Text className="text-center text-zinc-700">Clear user context</Text>
        </Pressable>
        <Text className="text-sm text-zinc-700">{result}</Text>
        <Text className="text-sm text-zinc-700">Context: {contextResult}</Text>
      </View>
    </SafeAreaView>
  );
}
