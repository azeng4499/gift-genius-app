import { Image } from "expo-image";
import { ThemedText } from "@/components/themed-text";
import * as Haptics from "expo-haptics";
import {
  Bookmark,
  Check,
  Share,
  ShoppingBag,
  Sparkles,
  Star,
  StarHalf,
  ThumbsDown,
} from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { QueueItemDto } from "@/lib/api/client";
import ProductCardChip from "./components/product-card-chip";

type InteractionType = "like" | "pass" | "save";

function CarouselDot({
  index,
  activeIndex,
}: {
  index: number;
  activeIndex: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = Math.round(activeIndex.value) === index;
    return {
      width: withTiming(isActive ? 20 : 6, { duration: 200 }),
      backgroundColor: withTiming(isActive ? "#333" : "#ccc", {
        duration: 200,
      }),
    };
  });

  return (
    <Animated.View style={[{ height: 6, borderRadius: 3 }, animatedStyle]} />
  );
}

type ProductCardProps = {
  item: QueueItemDto | null;
  queueRemaining?: number | null;
  onSparklesPress?: () => void;
  onInteraction?: (type: InteractionType) => void;
  interactionInFlight?: boolean;
  activeInteractionType?: InteractionType | null;
  appliedInteractionType?: InteractionType | null;
};

const ProductCard = ({
  item,
  queueRemaining,
  onSparklesPress,
  onInteraction,
  interactionInFlight = false,
  activeInteractionType = null,
  appliedInteractionType = null,
}: ProductCardProps) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [isOpening, setIsOpening] = useState(false);
  const activeIndex = useSharedValue(0);
  const [isCarouselLongPress, setIsCarouselLongPress] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carouselImages =
    item?.imageUrl && item.imageUrl.length > 0
      ? [{ uri: item.imageUrl }]
      : [{ uri: "https://placehold.co/600x600?text=No+Image" }];
  const priceLabel =
    item?.priceCents != null && item.currency
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: item.currency,
        }).format(item.priceCents / 100)
      : "Price unavailable";
  const buyUrl = item?.buyUrl;
  const interactionTypeToShow = activeInteractionType ?? appliedInteractionType;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (containerWidth > 0) {
        activeIndex.value = e.nativeEvent.contentOffset.x / containerWidth;
      }
    },
    [containerWidth, activeIndex],
  );

  const renderCarouselItem = useCallback(
    ({ item: imageItem }: { item: (typeof carouselImages)[number] }) => (
      <View
        style={{ width: containerWidth }}
        className="bg-white flex justify-center items-center"
      >
        <Image
          source={imageItem.uri}
          style={{ width: containerWidth, height: containerWidth }}
          contentFit="contain"
          contentPosition="center"
          cachePolicy="memory-disk"
          transition={120}
        />
      </View>
    ),
    [containerWidth, carouselImages],
  );

  return (
    <View className="w-full h-full overflow-hidden bg-neutral-100 rounded-xl border border-neutral-200">
      <View
        className="w-full aspect-square relative"
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        onTouchStart={() => {
          longPressTimer.current = setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsCarouselLongPress(true);
          }, 300);
        }}
        onTouchMove={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        onTouchEnd={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          if (isCarouselLongPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          setIsCarouselLongPress(false);
        }}
      >
        {containerWidth > 0 && (
          <FlatList
            data={carouselImages}
            renderItem={renderCarouselItem}
            keyExtractor={(_, i) => i.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            bounces={false}
          />
        )}
        {!isCarouselLongPress && (
          <View
            className="absolute bottom-0 top-0 left-0 right-0 flex justify-between items-center w-full h-full pt-2 px-2 pb-4"
            pointerEvents="box-none"
          >
            <View className="w-full flex flex-row justify-end items-end">
              <Pressable
                className="p-4 rounded-xl"
                style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
                onPress={() => {
                  onSparklesPress?.();
                }}
              >
                <Sparkles size={20} color="white" strokeWidth={1.5} />
              </Pressable>
            </View>
            <View
              className="flex-row justify-center items-center gap-1.5"
              pointerEvents="none"
            >
              {carouselImages.map((_, i) => (
                <CarouselDot key={i} index={i} activeIndex={activeIndex} />
              ))}
            </View>
          </View>
        )}
      </View>
      <View className="w-full flex flex-row justify-between items-end px-4 py-6">
        <View className="flex flex-row gap-2 items-start justify-center">
          <View className="flex flex-row gap-1">
            <Star size={16} color="#C2A14A" fill="#C2A14A" />
            <Star size={16} color="#C2A14A" fill="#C2A14A" />
            <Star size={16} color="#C2A14A" fill="#C2A14A" />
            <Star size={16} color="#C2A14A" fill="#C2A14A" />
            <StarHalf size={16} color="#C2A14A" fill="#C2A14A" />
          </View>
          <ThemedText fontWeight="thin">{"(2k+)"}</ThemedText>
        </View>
        <View className="flex flex-row gap-4 items-center">
          <Pressable
            disabled={interactionInFlight || !item}
            onPress={() => onInteraction?.("save")}
          >
            <Bookmark
              size={24}
              color={interactionTypeToShow === "save" ? "#1f7a5c" : "black"}
              fill={interactionTypeToShow === "save" ? "#1f7a5c" : "transparent"}
              strokeWidth={1.25}
            />
          </Pressable>
          <Pressable
            disabled={interactionInFlight || !item}
            onPress={() => onInteraction?.("pass")}
          >
            <ThumbsDown
              size={24}
              color={interactionTypeToShow === "pass" ? "#b42318" : "black"}
              fill={interactionTypeToShow === "pass" ? "#b42318" : "transparent"}
              strokeWidth={1.25}
            />
          </Pressable>
          <Pressable
            disabled={interactionInFlight || !item}
            onPress={() => onInteraction?.("like")}
          >
            <Star size={24} color="black" strokeWidth={1.25} />
          </Pressable>
        </View>
      </View>
      <View className="w-full px-4 flex-row flex justify-between items-start">
        <Text className="text-2xl leading-20v font-noto-serif-bold text-black">
          {item?.title ?? "Loading recommendation..."}
        </Text>
      </View>
      <View className="w-full px-4 py-6 flex-row flex justify-between items-start">
        <View className="flex flex-row items-end gap-3">
          <View className="flex flex-row items-center gap-2">
            <View
              className="p-0.5 rounded-full flex justify-center items-center"
              style={{ backgroundColor: "rgba(31, 122, 92, 1)" }}
            >
              <Check size={12} color="white" />
            </View>
            <ThemedText fontWeight="light">In-range</ThemedText>
          </View>
          <Text className="text-zinc-600">|</Text>
          <ThemedText>{priceLabel}</ThemedText>
        </View>
        <ThemedText fontWeight="light">
          {typeof queueRemaining === "number"
            ? `${queueRemaining} left`
            : ""}
        </ThemedText>
      </View>
      <View className="w-full flex-1 flex flex-row justify-between items-end pb-4 px-4">
        <View className="flex flex-row gap-3">
          {(item?.tags.length ? item.tags : ["No tags"]).slice(0, 2).map((tag) => (
            <ProductCardChip key={tag} label={tag} />
          ))}
        </View>
        <Share size={24} color="black" strokeWidth={1.25} />
      </View>
      <View className="w-full">
        <View className="px-4">
          <View className="w-full h-0.5 bg-zinc-200 "></View>
          <View className="py-4 flex-row flex gap-3">
            <Pressable
              onPress={() => {
                setIsOpening(true);
                if (!buyUrl) {
                  setIsOpening(false);
                  return;
                }
                Linking.openURL(buyUrl).finally(() => setIsOpening(false));
              }}
              disabled={isOpening || !buyUrl}
              className="h-14 flex-1 p-1 flex justify-center items-center flex-row gap-2"
              style={{
                backgroundColor: isOpening
                  ? "rgba(31, 122, 92, 0.7)"
                  : "rgba(31, 122, 92, 1)",
              }}
            >
              {isOpening ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View className="flex-row flex items-center justify-center gap-2">
                  <ThemedText fontWeight="semibold" fontStyle="rounded" inverse>
                    Shop this item
                  </ThemedText>
                  <ShoppingBag size={16} color="white" strokeWidth={2} />
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProductCard;
