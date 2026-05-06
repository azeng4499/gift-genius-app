import { router } from "expo-router";
import Constants from "expo-constants";
import { ChevronRight, CircleUserRound } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { createGiftGeniusApiClient, type UserDto } from "@/lib/api/client";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import {
  clearUserContext,
  getAccessToken,
  getCurrentFeedId,
  getCurrentUserId,
} from "@/lib/state/user-context";

function Row({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between border-b border-zinc-100 py-3 active:bg-zinc-50"
    >
      <View className="mr-4 flex-1 shrink">
        <Text className="text-base font-medium text-zinc-900">{title}</Text>
        {subtitle ? (
          <ThemedText className="mt-0.5 text-sm text-zinc-500">{subtitle}</ThemedText>
        ) : null}
      </View>
      <ChevronRight size={20} color="#a1a1aa" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getUserId: () => getCurrentUserId(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

  const [userProfile, setUserProfile] = useState<UserDto | null>(null);
  const [currentFeedSummary, setCurrentFeedSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const uid = getCurrentUserId();
    const fid = getCurrentFeedId();
    if (!uid) {
      setUserProfile(null);
      setCurrentFeedSummary(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const feeds = await api.getFeeds(uid);
      const users = await api.getUsers();
      const me = users.find((u) => u.id === uid) ?? null;
      setUserProfile(me);
      const current = fid ? feeds.find((f) => f.id === fid) : null;
      setCurrentFeedSummary(
        current ? `${current.name} (#${current.id})` : feeds.length ? `${feeds.length} feeds` : "No feeds"
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load profile.");
      setUserProfile(null);
      setCurrentFeedSummary(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const appVersion = Constants.expoConfig?.version ?? "development";

  const apiBaseHint = useMemo(() => {
    try {
      const u = getGiftGeniusApiBaseUrl();
      const host = new URL(u).hostname;
      return host || u.slice(0, 40);
    } catch {
      return getGiftGeniusApiBaseUrl().slice(0, 48);
    }
  }, []);

  const onReconnectDemo = () => {
    Alert.alert(
      "Reconnect demo session?",
      "This clears cached user ID, feed ID, and token on this device, then signs you back in with the bundled demo flow.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reconnect",
          style: "destructive",
          onPress: () => {
            clearUserContext();
            router.replace({
              pathname: "/",
              params: { reconnectKey: String(Date.now()) },
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        <View className="items-center pb-4 pt-2">
          <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-zinc-100">
            <CircleUserRound size={44} color="#52525b" strokeWidth={1.5} />
          </View>
          <Text className="font-noto-serif-bold text-xl text-zinc-900">Demo profile</Text>
          <ThemedText className="mt-1 max-w-xs text-center text-sm text-zinc-500">
            One built-in GiftGenius user on this phone—use shortcuts below to tweak feeds or debug the API.
          </ThemedText>
        </View>

        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator />
            <Text className="mt-3 text-zinc-500">Loading …</Text>
          </View>
        ) : null}

        {!loading && getCurrentUserId() == null ? (
          <View className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm font-medium text-amber-900">No active session</Text>
            <ThemedText className="mt-1 text-sm text-amber-800">
              Run Reconnect demo session to log in again, or pull to refresh on the home tab if you landed here without
              bootstrap.
            </ThemedText>
            <Pressable
              className="mt-3 rounded-md bg-amber-900 px-4 py-2"
              onPress={() =>
                router.replace({
                  pathname: "/",
                  params: { reconnectKey: String(Date.now()) },
                })
              }
            >
              <Text className="text-center text-white">Reconnect demo session</Text>
            </Pressable>
          </View>
        ) : null}

        {loadError ? (
          <View className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <Text className="text-sm text-red-800">{loadError}</Text>
            <Pressable onPress={reload} className="mt-2 self-start">
              <Text className="text-sm font-medium text-red-900">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && userProfile ? (
          <View className="mb-6 rounded-xl border border-zinc-200 p-4">
            <Text className="font-noto-serif-bold text-lg text-zinc-900">{userProfile.name}</Text>
            {userProfile.email ? (
              <ThemedText className="mt-1 text-sm text-zinc-600">{userProfile.email}</ThemedText>
            ) : null}
            <View className="mt-4 gap-2 border-t border-zinc-100 pt-4">
              <View className="flex-row justify-between">
                <ThemedText className="text-sm text-zinc-500">User ID</ThemedText>
                <Text className="text-sm text-zinc-900">{userProfile.id}</Text>
              </View>
              <View className="flex-row justify-between">
                <ThemedText className="text-sm text-zinc-500">Current feed</ThemedText>
                <Text className="flex-1 pl-4 text-right text-sm text-zinc-900">{currentFeedSummary ?? "—"}</Text>
              </View>
              <View className="flex-row justify-between">
                <ThemedText className="text-sm text-zinc-500">Signed in</ThemedText>
                <Text className="text-sm text-zinc-900">{getAccessToken() ? "Yes (Bearer)" : "No"}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Shortcuts
        </Text>
        <View className="rounded-xl border border-zinc-200 px-4">
          <Row
            title="Saved gifts"
            subtitle="Items you bookmarked on this feed"
            onPress={() => router.push("/bookmarks")}
          />
          <Row
            title="Current feed settings"
            subtitle="Relationship, interests, budget"
            onPress={() => router.push("/feed/settings")}
          />
          <Row title="Add a feed person" subtitle="Create another recipient feed" onPress={() => router.push("/feed/new")} />
          <Row title="Integration test screens" subtitle="Health checks and bootstrap" onPress={() => router.push("/test")} />
        </View>

        <Text className="mb-2 mt-8 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Demo toolkit
        </Text>
        <View className="rounded-xl border border-zinc-200 px-4">
          <Pressable onPress={onReconnectDemo} className="flex-row items-center justify-between py-4 active:bg-zinc-50">
            <View className="mr-4 flex-1 shrink">
              <Text className="text-base font-medium text-zinc-900">Clear and reconnect session</Text>
              <ThemedText className="mt-0.5 text-sm text-zinc-500">
                Drops local IDs and runs the bundled login again.
              </ThemedText>
            </View>
          </Pressable>
        </View>

        <View className="mt-10 mb-10 items-center gap-1">
          <ThemedText className="text-center text-xs text-zinc-400">API · {apiBaseHint}</ThemedText>
          <Text className="text-center text-xs text-zinc-400">GiftGenius app · v{appVersion}</Text>
          <ThemedText className="mt-2 text-center text-xs text-zinc-400">Expo Router · React Native</ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
