import { ThemedText } from "@/components/themed-text";
import type { QueueItemDto } from "@/lib/api/client";
import { Image } from "expo-image";
import { Bookmark, Check, ShoppingBag, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import ProductCardChip from "./components/product-card-chip";

type InteractionType = "pass" | "save" | "shop";

const NO_IMAGE = "https://placehold.co/600x600?text=No+Image";

type ProductCardProps = {
  item: QueueItemDto | null;
  /** Pass `{ clear: true }` when tapping an action that already applies. */
  onInteraction?: (type: InteractionType, opts?: { clear?: boolean }) => void;
  interactionInFlight?: boolean;
  activeInteractionType?: InteractionType | null;
  appliedInteractionType?: InteractionType | null;
};

const ProductCard = ({
  item,
  onInteraction,
  interactionInFlight = false,
  activeInteractionType = null,
  appliedInteractionType = null,
}: ProductCardProps) => {
  const [isOpening, setIsOpening] = useState(false);

  const imageUri = item?.imageUrl && item.imageUrl.length > 0 ? item.imageUrl : NO_IMAGE;
  const hasPrice = item?.priceCents != null && !!item?.currency;
  const priceLabel = hasPrice
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: item!.currency!,
      }).format(item!.priceCents! / 100)
    : "Price at Amazon";
  const buyUrl = item?.buyUrl;
  const shown = activeInteractionType ?? appliedInteractionType;
  const isSaved = shown === "save";
  const isPassed = shown === "pass";

  return (
    <View className="flex-1 w-full overflow-hidden flex flex-col rounded-3xl border border-zinc-200 bg-white">
      {/* Image */}
      <View className="w-full flex-1 min-h-0 bg-zinc-50">
        <Image
          source={imageUri}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          contentPosition="center"
          cachePolicy="memory-disk"
          transition={140}
        />
      </View>

      {/* Details */}
      <View className="w-full shrink-0 px-5 pt-4 pb-5">
        <View className="w-full flex-row items-center justify-end">
          <View className="flex-row items-center gap-4">
            <Pressable
              disabled={interactionInFlight || !item}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? "Saved" : "Save this gift"}
              hitSlop={10}
              onPress={() => onInteraction?.("save", { clear: isSaved })}
            >
              <Bookmark
                size={24}
                color={isSaved ? "#1f7a5c" : "#18181b"}
                fill={isSaved ? "#1f7a5c" : "transparent"}
                strokeWidth={1.5}
              />
            </Pressable>
            <Pressable
              disabled={interactionInFlight || !item}
              accessibilityRole="button"
              accessibilityLabel="Not for them"
              hitSlop={10}
              onPress={() => onInteraction?.("pass", { clear: isPassed })}
            >
              <X size={24} color={isPassed ? "#b42318" : "#18181b"} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        <Text
          className="mt-2 font-noto-serif-bold text-[22px] leading-tight text-zinc-900"
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {item?.title ?? "Loading recommendation…"}
        </Text>

        <View className="mt-3 flex-row items-center gap-3">
          <ThemedText fontWeight="semibold" className="text-[17px] text-zinc-900">
            {priceLabel}
          </ThemedText>
          {hasPrice ? (
            <View className="flex-row items-center gap-1.5">
              <View
                className="items-center justify-center rounded-full p-0.5"
                style={{ backgroundColor: "#1f7a5c" }}
              >
                <Check size={11} color="white" strokeWidth={3} />
              </View>
              <ThemedText fontWeight="light" className="text-[13px] text-zinc-500">
                In budget
              </ThemedText>
            </View>
          ) : null}
        </View>

        {item?.tags.length ? (
          <View className="mt-3 flex-row gap-2">
            {item.tags.slice(0, 2).map((tag) => (
              <ProductCardChip key={tag} label={tag} />
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            if (!buyUrl) return;
            // Record purchase intent (shop_now) then hand off to Amazon.
            onInteraction?.("shop");
            setIsOpening(true);
            Linking.openURL(buyUrl).finally(() => setIsOpening(false));
          }}
          disabled={isOpening || !buyUrl}
          className="mt-5 h-14 flex-row items-center justify-center gap-2 rounded-full"
          style={{ backgroundColor: isOpening ? "rgba(31,122,92,0.7)" : "#1f7a5c" }}
        >
          {isOpening ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <ThemedText fontWeight="semibold" fontStyle="rounded" inverse>
                Shop this gift
              </ThemedText>
              <ShoppingBag size={16} color="white" strokeWidth={2} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

export default ProductCard;
