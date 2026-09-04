import { useClerk } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ChevronRight,
  CircleUserRound,
  LogOut,
  Pencil,
  Plus,
  Users,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { getApiClient } from "@/lib/api";
import { loadProfilesForUser } from "@/lib/api/bootstrap";
import { getGiftGeniusApiBaseUrl } from "@/lib/api/config";
import { clearStoredJwt } from "@/lib/state/auth-store";
import {
  clearUserContext,
  getCurrentFeedId,
  getCurrentUserId,
} from "@/lib/state/user-context";
import { useAppUser } from "@/lib/use-app-user";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="mb-2 px-1 text-sm text-slate-600"
      fontStyle="sf-display-medium"
    >
      {children}
    </Text>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
  destructive,
  busy,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  busy?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-slate-50 ${
        last ? "" : "border-b border-slate-100"
      }`}
      style={{ opacity: busy ? 0.6 : 1 }}
    >
      <View
        className={`h-9 w-9 items-center justify-center rounded-full ${
          destructive ? "bg-red-50" : "bg-slate-100"
        }`}
      >
        {icon}
      </View>
      <View className="flex-1 pr-2">
        <Text
          className={`text-base ${destructive ? "text-red-700" : "text-slate-900"}`}
          fontStyle="sf-display-semibold"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="mt-0.5 text-[13px] text-slate-500"
            fontStyle="sf-display-light"
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator color={destructive ? "#b91c1c" : "#1f7a5c"} />
      ) : (
        <ChevronRight size={20} color="#cbd5e1" />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user } = useAppUser();
  const { signOut } = useClerk();
  const api = useMemo(() => getApiClient(), []);

  const [activeFeedName, setActiveFeedName] = useState<string | null>(null);
  const [hasActiveFeed, setHasActiveFeed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const reload = useCallback(async () => {
    const uid = getCurrentUserId();
    const profileId = getCurrentFeedId();
    if (!uid) {
      setActiveFeedName(null);
      setHasActiveFeed(false);
      return;
    }
    try {
      const profiles = await loadProfilesForUser(api, uid);
      const current = profileId
        ? profiles.find((f) => f.id === profileId)
        : null;
      setActiveFeedName(current?.name ?? null);
      setHasActiveFeed(Boolean(current));
    } catch {
      setActiveFeedName(null);
      setHasActiveFeed(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      // Clear local state first so the auth gate doesn't briefly remount the
      // home screen with the previous user's id still cached.
      clearUserContext();
      await clearStoredJwt();
      await signOut();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed.";
      Alert.alert("Sign out had an issue", message);
    } finally {
      setSigningOut(false);
    }
  }, [signOut]);

  const confirmSignOut = useCallback(() => {
    Alert.alert("Sign out?", "You’ll need to sign back in to access your feeds.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: handleSignOut },
    ]);
  }, [handleSignOut]);

  const appVersion = Constants.expoConfig?.version ?? "development";
  const apiBaseHint = useMemo(() => {
    try {
      return new URL(getGiftGeniusApiBaseUrl()).hostname;
    } catch {
      return getGiftGeniusApiBaseUrl().slice(0, 48);
    }
  }, []);

  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const displayName = user?.fullName ?? email ?? "Signed in";

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-6 pb-4 pt-2">
        <Text className="text-xl text-slate-700" fontStyle="noto-serif-bold">
          Settings
        </Text>
        <Text className="px-1 pt-1" fontStyle="sf-display-light">
          Manage your account and the feed you’re shopping.
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* Account card */}
        <View className="mb-6 flex-row items-center gap-4 rounded-xl border border-slate-300 bg-white p-4">
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-100">
            {user?.imageUrl ? (
              <Image
                source={user.imageUrl}
                style={{ width: 56, height: 56 }}
                contentFit="cover"
              />
            ) : (
              <CircleUserRound size={32} color="#64748b" strokeWidth={1.5} />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className="text-base text-slate-900"
              fontStyle="sf-display-semibold"
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {email && user?.fullName ? (
              <Text
                className="mt-0.5 text-[13px] text-slate-500"
                fontStyle="sf-display-light"
                numberOfLines={1}
              >
                {email}
              </Text>
            ) : null}
          </View>
        </View>

        <SectionLabel>Feeds</SectionLabel>
        <View className="mb-6 overflow-hidden rounded-xl border border-slate-300 bg-white">
          {hasActiveFeed ? (
            <Row
              icon={<Pencil size={18} color="#1f7a5c" strokeWidth={2} />}
              title="Edit current feed"
              subtitle={
                activeFeedName
                  ? `Shopping for ${activeFeedName}`
                  : "Interests, budget, and occasion"
              }
              onPress={() => router.push("/feed/edit")}
            />
          ) : null}
          <Row
            icon={<Users size={18} color="#64748b" strokeWidth={2} />}
            title="Manage feeds"
            subtitle="Switch, edit, or delete your people"
            onPress={() => router.push("/people")}
          />
          <Row
            icon={<Plus size={18} color="#64748b" strokeWidth={2} />}
            title="Add someone"
            subtitle="Start a new gift feed"
            onPress={() => router.push("/feed/start")}
            last
          />
        </View>

        <SectionLabel>Account</SectionLabel>
        <View className="overflow-hidden rounded-xl border border-slate-300 bg-white">
          <Row
            icon={<LogOut size={18} color="#b91c1c" strokeWidth={2} />}
            title="Sign out"
            subtitle="Ends your session on this device"
            onPress={confirmSignOut}
            destructive
            busy={signingOut}
            last
          />
        </View>

        <View className="mt-10 items-center gap-1">
          <Text className="text-xs text-slate-400" fontStyle="sf-display-light">
            API · {apiBaseHint}
          </Text>
          <Text className="text-xs text-slate-400" fontStyle="sf-display-light">
            GiftGenius · v{appVersion}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
