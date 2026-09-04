import { Text } from "@/components/ui/text";
import { CtaButton } from "@/components/ui/cta-button";
import type { QueueItemDto } from "@/lib/api/client";
import {
  formatPrice,
  type AppliedInteraction,
  type InteractionKind,
} from "@/lib/api/mappers";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Separator } from "@/components/ui/separator";

import {
  Bookmark,
  ShoppingBag,
  Star,
  StarHalf,
  ThumbsDown,
} from "lucide-react-native";
import { memo, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";

const NO_IMAGE = "https://placehold.co/600x600?text=No+Image";

const TITLE_LINE_HEIGHT = 28;

// Shadow for the round action buttons floating over the product image.
const ACTION_BUTTON_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 4,
};

type ProductCardProps = {
  item: QueueItemDto | null;
  /** Pass `{ clear: true }` when tapping an action that already applies. */
  onInteraction?: (type: InteractionKind, opts?: { clear?: boolean }) => void;
  interactionInFlight?: boolean;
  activeInteractionType?: AppliedInteraction | null;
  appliedInteractionType?: AppliedInteraction | null;
};

const STAR_SIZE = 18;
const STAR_FILLED = "#f59e0b";
const STAR_EMPTY = "#d4d4d8";

/**
 * Five stars filled to the nearest half, matching how Amazon renders a rating
 * like 4.7. Each half star is drawn over an empty one so the unfilled portion
 * still reads as a star rather than a floating shard.
 */
function StarRating({ rating }: { rating: number }) {
  return (
    <View className="flex-row items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((index) => {
        const remaining = rating - index;
        const empty = (
          <Star
            size={STAR_SIZE}
            color={STAR_EMPTY}
            fill={STAR_EMPTY}
            strokeWidth={0}
          />
        );

        if (remaining >= 0.75) {
          return (
            <Star
              key={index}
              size={STAR_SIZE}
              color={STAR_FILLED}
              fill={STAR_FILLED}
              strokeWidth={0}
            />
          );
        }
        if (remaining >= 0.25) {
          return (
            <View key={index}>
              {empty}
              <View className="absolute">
                <StarHalf
                  size={STAR_SIZE}
                  color={STAR_FILLED}
                  fill={STAR_FILLED}
                  strokeWidth={0}
                />
              </View>
            </View>
          );
        }
        return <View key={index}>{empty}</View>;
      })}
    </View>
  );
}

// Tags arrive as human-readable phrases ("Board Games", "For the occasion"),
// so collapse them into a single hashtag token rather than "#Board Games".
function toHashtag(tag: string): string {
  const token = tag
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  return `#${token}`;
}

const ProductCard = ({
  item,
  onInteraction,
  interactionInFlight = false,
  activeInteractionType = null,
  appliedInteractionType = null,
}: ProductCardProps) => {
  const imageUri =
    item?.imageUrl && item.imageUrl.length > 0 ? item.imageUrl : NO_IMAGE;
  const tags = item?.tags ?? [];
  const title = item?.title?.trim() || "Untitled gift";
  const buyUrl = item?.buyUrl;
  const rating = item?.rating ?? null;
  const ratingsCount = item?.ratingsCount ?? null;
  const [isOpening, setIsOpening] = useState(false);

  // In-flight action wins so the tap reads as immediate, falling back to the
  // signal already recorded for this item.
  const shown = activeInteractionType ?? appliedInteractionType;
  const isSaved = shown === "save";
  const isDisliked = shown === "dislike";
  const actionsDisabled = interactionInFlight || !item;

  const tapFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  return (
    <View className="flex-1 w-full overflow-hidden flex flex-col rounded-3xl border border-zinc-300 bg-white">
      <View className="w-full h-3/5 min-h-0 bg-zinc-50 relative">
        <Image
          source={imageUri}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          contentPosition="center"
          cachePolicy="memory-disk"
          transition={140}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.35)"]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "50%",
          }}
          pointerEvents="none"
        />
        <View className="absolute bottom-3 right-3 items-center gap-3 flex flex-row">
          <Pressable
            onPress={() => {
              tapFeedback();
              onInteraction?.("dislike", { clear: isDisliked });
            }}
            disabled={actionsDisabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isDisliked ? "Disliked" : "Dislike this gift"}
            style={ACTION_BUTTON_SHADOW}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/90"
          >
            <ThumbsDown
              size={22}
              color="#3f3f46"
              fill={isDisliked ? "#3f3f46" : "transparent"}
              strokeWidth={2}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              tapFeedback();
              onInteraction?.("save", { clear: isSaved });
            }}
            disabled={actionsDisabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? "Saved" : "Bookmark this gift"}
            style={ACTION_BUTTON_SHADOW}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/90"
          >
            <Bookmark
              size={22}
              color={isSaved ? "#f59e0b" : "#3f3f46"}
              fill={isSaved ? "#f59e0b" : "transparent"}
              strokeWidth={2}
            />
          </Pressable>
        </View>
      </View>

      <View className="w-full flex-1 p-4 bg-sheet-surface/50">
        <View className="flex-1 min-h-0">
          {tags.length > 0 ? (
            <View className="w-full flex justify-start gap-2 flex-row mb-1">
              {tags.map((tag) => (
                <Text
                  key={tag}
                  className="shrink text-slate-500"
                  numberOfLines={1}
                >
                  {toHashtag(tag)}
                </Text>
              ))}
            </View>
          ) : null}
          <Text
            className="text-lg text-slate-700"
            style={{ lineHeight: TITLE_LINE_HEIGHT }}
            fontStyle="noto-serif-bold"
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          <View className="flex-row items-center py-4">
            <Separator className="flex-1 bg-black/20" />
          </View>
          <View className="flex-row items-center justify-between pb-4 px-2">
            <Text className="text-zinc-900" fontStyle="sf-rounded-medium">
              {formatPrice(item)}
            </Text>
            {rating != null ? (
              <View className="flex-row items-center gap-1.5">
                <StarRating rating={rating} />
                {ratingsCount != null && ratingsCount > 0 ? (
                  <Text className="text-zinc-500" fontStyle="sf-display-regular">
                    ({ratingsCount.toLocaleString("en-US")})
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
        <View className="flex-row">
          <View className="flex-1">
            <CtaButton
              label="Shop this gift"
              icon={<ShoppingBag size={16} color="white" strokeWidth={2} />}
              loading={isOpening}
              disabled={!buyUrl}
              onPress={() => {
                if (!buyUrl) return;
                // Record purchase intent before handing off to Amazon.
                onInteraction?.("shop");
                setIsOpening(true);
                Linking.openURL(buyUrl)
                  .catch(() => {})
                  .finally(() => setIsOpening(false));
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

// Memoized so interacting with the current card doesn't re-render every other
// card in the feed (which replayed each image's fade and read as a "reload").
export default memo(ProductCard);
