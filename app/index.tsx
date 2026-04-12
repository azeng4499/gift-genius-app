import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  Bookmark,
  ChevronDown,
  CircleUserRound,
  House,
  Layers,
  Newspaper,
  SlidersHorizontal,
} from "lucide-react-native";

import ProductCard from "@/components/product-card/product-card";

const FEED_DATA = [
  { id: "1" },
  { id: "2" },
  { id: "3" },
  { id: "4" },
  { id: "5" },
];

export default function SwipeScreen() {
  const insets = useSafeAreaInsets();
  const [feedHeight, setFeedHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%", "100%"], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const onRefresh = useCallback(() => {
    // setRefreshing(true);
    // setRefreshing(false);
  }, []);

  const renderItem = useCallback(
    () => (
      <View style={{ height: feedHeight }} className="w-full py-2">
        <ProductCard
          onSparklesPress={() => bottomSheetRef.current?.snapToIndex(0)}
        />
      </View>
    ),
    [feedHeight],
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ThemedView className="w-full h-full bg-white">
        <View className="w-full flex-row h-16 flex justify-between items-center p-4">
          <View className="flex-row justify-center items-end gap-1">
            <Text className="text-lg font-noto-serif-bold">
              Emma's Birthday
            </Text>
            <ChevronDown size={24} color="black" strokeWidth={1.5} />
          </View>
          <SlidersHorizontal size={30} color="black" strokeWidth={1.5} />
        </View>
        <View className="relative flex-1 px-2">
          <View
            className="w-full h-full"
            onLayout={(e) => setFeedHeight(e.nativeEvent.layout.height)}
          >
            {feedHeight > 0 && (
              <FlatList
                data={FEED_DATA}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToAlignment="start"
                decelerationRate="fast"
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                }
                getItemLayout={(_, index) => ({
                  length: feedHeight,
                  offset: feedHeight * index,
                  index,
                })}
              />
            )}
          </View>
          <LinearGradient
            colors={["rgba(0,0,0,0.15)", "transparent"]}
            className="absolute left-0 right-0 top-0 h-3"
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.15)"]}
            className="absolute left-0 right-0 bottom-0 h-3"
            pointerEvents="none"
          />
        </View>
        <View className="w-full pt-6 pb-2 flex-row flex justify-around items-center px-4">
          <House size={24} color="black" strokeWidth={1.5} />
          <Layers size={24} color="black" strokeWidth={1.5} />
          <Newspaper size={24} color="black" strokeWidth={1.5} />
          <Bookmark size={24} color="black" strokeWidth={1.5} />
          <CircleUserRound size={24} color="black" strokeWidth={1.5} />
        </View>
      </ThemedView>
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        topInset={insets.top}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: "#fff" }}
        handleIndicatorStyle={{ backgroundColor: "#ccc" }}
      >
        <BottomSheetView className="flex-1 p-4">
          <ThemedText fontStyle="serif" fontWeight="bold" className="text-lg">
            Explore Similar
          </ThemedText>
          <ThemedText className="mt-2 text-zinc-500">
            Here are some other items that give the same vibe.
          </ThemedText>
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}
