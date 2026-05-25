import { useClerk, useUser } from "@clerk/clerk-expo";
import { router } from "expo-router";
import Constants from "expo-constants";
import { ChevronRight, CircleUserRound } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { createGiftGeniusApiClient } from "@/lib/api/client";
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

function SignOutRow() {
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // Drop local app state first so AuthGate's redirect doesn't briefly
      // remount the home screen with the previous user's id still cached.
      clearUserContext();
      await signOut();
      // AuthGate (root layout) routes us to /(auth)/sign-in when
      // isSignedIn flips to false; no router call needed here.
    } catch (err) {
      // signOut failed (e.g. offline). Clerk has already cleared local
      // state optimistically, so the gate will still bounce us — but
      // surface the issue so it isn't silent.
      const message = err instanceof Error ? err.message : "Sign out failed.";
      Alert.alert("Sign out had an issue", message);
    } finally {
      setSigningOut(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert(
      "Sign out?",
      "You'll need to sign back in to access your feeds.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: handleSignOut },
      ]
    );
  };

  return (
    <Pressable
      onPress={confirmSignOut}
      disabled={signingOut}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      className="flex-row items-center justify-between py-4 active:bg-zinc-50"
      style={{ opacity: signingOut ? 0.6 : 1 }}
    >
      <View className="mr-4 flex-1 shrink">
        <Text className="text-base font-medium text-red-700">Sign out</Text>
        <ThemedText className="mt-0.5 text-sm text-zinc-500">
          Ends your session and clears tokens on this device.
        </ThemedText>
      </View>
      {signingOut ? <ActivityIndicator color="#7f1d1d" /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user } = useUser();
  const api = useMemo(
    () =>
      createGiftGeniusApiClient({
        baseUrl: getGiftGeniusApiBaseUrl(),
        getUserId: () => getCurrentUserId(),
        getAccessToken: () => getAccessToken(),
      }),
    []
  );

  const [currentFeedSummary, setCurrentFeedSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const uid = getCurrentUserId();
    const fid = getCurrentFeedId();
    if (!uid) {
      setCurrentFeedSummary(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const feeds = await api.getFeeds(uid);
      const current = fid ? feeds.find((f) => f.id === fid) : null;
      setCurrentFeedSummary(
        current ? `${current.name} (#${current.id})` : feeds.length ? `${feeds.length} feeds` : "No feeds"
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load profile.");
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

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        <View className="items-center pb-4 pt-2">
          <View className="mb-3 h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-zinc-100">
            {user?.imageUrl ? (
              <Image
                source={{ uri: user.imageUrl }}
                className="h-20 w-20"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <CircleUserRound size={44} color="#52525b" strokeWidth={1.5} />
            )}
          </View>
          <Text className="font-noto-serif-bold text-xl text-zinc-900">
            {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
          </Text>
          {user?.fullName && user?.primaryEmailAddress?.emailAddress ? (
            <ThemedText className="mt-1 text-sm text-zinc-500">
              {user.primaryEmailAddress.emailAddress}
            </ThemedText>
          ) : null}
        </View>

        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator />
            <Text className="mt-3 text-zinc-500">Loading …</Text>
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

        {!loading && getCurrentUserId() != null ? (
          <View className="mb-6 rounded-xl border border-zinc-200 p-4">
            <View className="gap-2">
              <View className="flex-row justify-between">
                <ThemedText className="text-sm text-zinc-500">User ID</ThemedText>
                <Text className="text-sm text-zinc-900">{getCurrentUserId()}</Text>
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
        </View>

        <Text className="mb-2 mt-8 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Account
        </Text>
        <View className="rounded-xl border border-zinc-200 px-4">
          <SignOutRow />
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
