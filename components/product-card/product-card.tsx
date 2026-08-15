import { Text } from "@/components/ui/text";
import { CtaButton } from "@/components/ui/cta-button";
import type { QueueItemDto } from "@/lib/api/client";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Separator } from "@/components/ui/separator";

import {
  ArrowRight,
  Bookmark,
  ShoppingBag,
  Star,
  ThumbsDown,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
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
};

const ProductCard = ({ item }: ProductCardProps) => {
  const imageUri =
    item?.imageUrl && item.imageUrl.length > 0 ? item.imageUrl : NO_IMAGE;
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);

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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {},
              );
              setIsDisliked((prev) => !prev);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              isDisliked ? "Remove dislike" : "Dislike this gift"
            }
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {},
              );
              setIsFavorite((prev) => !prev);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              isFavorite ? "Remove bookmark" : "Bookmark this gift"
            }
            style={ACTION_BUTTON_SHADOW}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/90"
          >
            <Bookmark
              size={22}
              color={isFavorite ? "#f59e0b" : "#3f3f46"}
              fill={isFavorite ? "#f59e0b" : "transparent"}
              strokeWidth={2}
            />
          </Pressable>
        </View>
      </View>

      <View className="w-full flex-1 p-4 bg-sheet-surface/50">
        <View className="flex-1 min-h-0">
          <View className="w-full flex justify-start gap-2 flex-row mb-1">
            <Text className="text-slate-500">#Hiking</Text>
            <Text className="text-slate-500">#Breakfast</Text>
          </View>
          <Text
            className="text-lg text-slate-700"
            style={{ lineHeight: TITLE_LINE_HEIGHT }}
            fontStyle="noto-serif-bold"
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            AGOGO Pour Over Coffee Maker Set, 34oz Classic Style, 304 Stainless
            Filter | Barist AGOGO Pour Over Coffee Maker Set, 34oz Classic
            Style, 304 Stainless Fil O Pour Over Coffee Maker Set, 34oz Classic
            Style, 304 Stainless Filter | Barist AGOGO Pour Over Coffee Maker
            Set, 34oz Classic Style, 304 Stainless Fil
          </Text>
          <View className="flex-row items-center py-4">
            <Separator className="flex-1 bg-black/20" />
          </View>
          <View className="flex-row items-center justify-between pb-4 px-2">
            <Text className="text-zinc-900" fontStyle="sf-rounded-medium">
              $45.77
            </Text>
            <View className="flex-row items-center gap-1.5">
              <View className="flex-row items-center gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    size={18}
                    color="#f59e0b"
                    fill="#f59e0b"
                    strokeWidth={0}
                  />
                ))}
              </View>
              <Text className="text-zinc-500" fontStyle="sf-display-regular">
                (128)
              </Text>
            </View>
          </View>
        </View>
        <View className="flex-row">
          <View className="flex-1">
            <CtaButton
              label="Shop this gift"
              icon={<ShoppingBag size={16} color="white" strokeWidth={2} />}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProductCard;
