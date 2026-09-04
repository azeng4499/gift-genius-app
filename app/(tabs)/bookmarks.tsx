import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { ChevronDown, MoreVertical, Trash2 } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  SelectSheet,
  type SelectSheetItem,
  type SelectSheetRef,
} from "@/components/ui/select-sheet";
import { Separator } from "@/components/ui/separator";
import { SheetBackground } from "@/components/ui/sheet-background";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { getApiClient } from "@/lib/api";
import { loadProfilesForUser, startSessionForProfile } from "@/lib/api/bootstrap";
import type { FeedDto } from "@/lib/api/client";
import {
  formatPrice,
  savedItemToBookmarkItem,
  type BookmarkItemDto,
} from "@/lib/api/mappers";
import { getCurrentFeedId, getCurrentUserId } from "@/lib/state/user-context";

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

function itemSubtitle(item: BookmarkItemDto): string {
  const savedLabel = formatSavedAt(item.savedAt);
  const price = formatPrice(item);
  return [price, savedLabel ? `Saved ${savedLabel}` : null]
    .filter(Boolean)
    .join(" • ");
}

function SavedItemRow({
  item,
  onOpenMenu,
}: {
  item: BookmarkItemDto;
  onOpenMenu: (item: BookmarkItemDto) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-4">
      <Pressable
        className="flex-1 flex-row items-center gap-3 pr-3 active:opacity-60"
        onPress={() => {
          if (item.buyUrl) Linking.openURL(item.buyUrl);
        }}
        disabled={!item.buyUrl}
      >
        <View className="h-16 w-16 overflow-hidden rounded-lg bg-slate-100">
          {item.imageUrl ? (
            <Image
              source={item.imageUrl}
              style={{ width: 64, height: 64 }}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-[10px] text-slate-400">No image</Text>
            </View>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className="text-base text-slate-900"
            fontStyle="sf-display-semibold"
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text
            className="mt-0.5 text-[13px] text-slate-500"
            fontStyle="sf-display-light"
            numberOfLines={1}
          >
            {itemSubtitle(item)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => onOpenMenu(item)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Bookmark actions"
        className="h-9 w-9 items-center justify-center rounded-full active:bg-slate-100"
      >
        <MoreVertical size={18} color="#64748b" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

export default function BookmarksScreen() {
  const api = useMemo(() => getApiClient(), []);
  const toast = useToast();

  const [items, setItems] = useState<BookmarkItemDto[]>([]);
  const [feeds, setFeeds] = useState<FeedDto[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(() =>
    getCurrentFeedId(),
  );
  const [feedName, setFeedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingFeed, setSwitchingFeed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<BookmarkItemDto | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const feedSheetRef = useRef<SelectSheetRef>(null);
  const menuSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  const openMenu = useCallback((item: BookmarkItemDto) => {
    setMenuItem(item);
    menuSheetRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const feedSelectItems: SelectSheetItem[] = useMemo(
    () => feeds.map((feed) => ({ id: feed.id, title: feed.name })),
    [feeds],
  );

  const loadSavedItems = useCallback(
    async (isRefresh = false, profileIdOverride?: string) => {
      const profileId = profileIdOverride ?? getCurrentFeedId();
      const userId = getCurrentUserId();
      if (!profileId) {
        setItems([]);
        setFeeds([]);
        setSelectedFeedId(null);
        setFeedName(null);
        setError("Set up a feed first to start saving gifts.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
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
        setError(
          err instanceof Error ? err.message : "Failed to load saved items.",
        );
        setItems([]);
        setFeeds([]);
        setFeedName(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api],
  );

  useFocusEffect(
    useCallback(() => {
      loadSavedItems();
    }, [loadSavedItems]),
  );

  const switchFeed = useCallback(
    async (feedId: string) => {
      feedSheetRef.current?.dismiss();
      const feed = feeds.find((f) => f.id === feedId);
      if (!feed || feed.id === selectedFeedId || switchingFeed) return;

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
    [api, feeds, loadSavedItems, selectedFeedId, switchingFeed, toast],
  );

  const handleRemove = useCallback(async () => {
    if (!selectedFeedId || !menuItem || actionBusy) return;

    const removingId = menuItem.id;
    menuSheetRef.current?.dismiss();
    setActionBusy(true);
    try {
      await api.unsaveItem(selectedFeedId, removingId);
      setItems((prev) => prev.filter((item) => item.id !== removingId));
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

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-4 pb-4 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl text-slate-700" fontStyle="noto-serif-bold">
            Bookmarks
          </Text>
          {feeds.length > 0 ? (
            <Pressable
              onPress={() => feedSheetRef.current?.present()}
              accessibilityRole="button"
              accessibilityLabel="Switch feed"
              className="max-w-[55%] flex-row items-center gap-1 rounded-full border border-slate-300 bg-white py-1.5 pl-3.5 pr-2.5 active:opacity-70"
            >
              <Text
                className="shrink text-[13px] text-slate-900"
                fontStyle="sf-display-medium"
                numberOfLines={1}
              >
                {feedName ?? "Select feed"}
              </Text>
              <ChevronDown size={16} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>
        <Text className="pt-1" fontStyle="sf-display-light">
          Gifts you’ve saved while browsing.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1f7a5c" />
          <Text className="mt-3 text-slate-500" fontStyle="sf-display-light">
            {switchingFeed ? "Switching feeds…" : "Loading saved items…"}
          </Text>
        </View>
      ) : error ? (
        <View className="px-4">
          <View className="rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm text-red-700" fontStyle="sf-display-medium">
              {error}
            </Text>
            <Pressable
              onPress={() => loadSavedItems()}
              className="mt-3 self-start"
            >
              <Text
                className="text-sm text-red-800 underline"
                fontStyle="sf-display-medium"
              >
                Try again
              </Text>
            </Pressable>
          </View>
        </View>
      ) : items.length === 0 ? (
        <View className="px-4">
          <View className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <Text
              className="text-base text-slate-900"
              fontStyle="sf-display-semibold"
            >
              Nothing saved yet
            </Text>
            <Text
              className="mt-1.5 text-sm text-slate-500"
              fontStyle="sf-display-light"
            >
              {feedName
                ? `Tap the bookmark icon on a gift in ${feedName}’s feed to save it here.`
                : "Tap the bookmark icon on a gift card in your feed to save it here."}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SavedItemRow item={item} onOpenMenu={openMenu} />
          )}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadSavedItems(true)}
              tintColor="#1f7a5c"
            />
          }
        />
      )}

      <SelectSheet
        ref={feedSheetRef}
        heading="Whose saved gifts?"
        subheading="Switch feeds to see another person’s bookmarked items."
        data={feedSelectItems}
        selectedId={selectedFeedId}
        onSelect={(item) => switchFeed(item.id)}
      />

      <BottomSheetModal
        ref={menuSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        topInset={insets.top}
        backdropComponent={renderBackdrop}
        backgroundComponent={SheetBackground}
        handleIndicatorStyle={{ backgroundColor: "#ccc" }}
      >
        <BottomSheetView
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16 + insets.bottom,
          }}
        >
          <View>
            <Text
              className="text-left text-xl text-slate-700"
              fontStyle="noto-serif-bold"
              numberOfLines={2}
            >
              {menuItem?.title ?? "Saved gift"}
            </Text>
            <Text
              className="px-1 pb-6 pt-1 text-left"
              fontStyle="sf-display-light"
            >
              Remove this gift from your saved list.
            </Text>
          </View>

          <Pressable
            onPress={handleRemove}
            className="flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{ backgroundColor: "rgba(255,255,255,0.5)" }}
          >
            <Trash2 size={20} color="#dc2626" strokeWidth={2} />
            <Text
              className="text-base font-sf-display-semibold"
              style={{ color: "#dc2626" }}
            >
              Remove item
            </Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}
