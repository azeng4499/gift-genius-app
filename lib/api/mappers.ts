import type { FeedDto, FeedItemDto, ProfileDetailDto, QueueItemDto } from "./client";

const BACKEND_OCCASIONS = new Set([
  "birthday",
  "christmas",
  "mothers_day",
  "fathers_day",
  "anniversary",
  "graduation",
  "housewarming",
  "just_because",
]);

/** Map legacy form occasion values to backend session occasions. */
export function toBackendOccasion(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (BACKEND_OCCASIONS.has(raw)) return raw;
  switch (raw) {
    case "holiday":
      return "christmas";
    case "wedding":
      return "anniversary";
    default:
      return "just_because";
  }
}

export function profileToFeedDto(profile: ProfileDetailDto): FeedDto {
  return {
    id: profile.id,
    userId: profile.user_id,
    name: profile.label,
    ageMin: null,
    ageMax: null,
    relationship: null,
    interests: profile.hobbies?.map((h) => h.name) ?? [],
    budgetMin: profile.budget_min,
    budgetMax: profile.budget_max,
    occasion: null,
    tagWeights: {},
    createdAt: profile.created_at ?? null,
  };
}

export function feedItemToQueueItem(item: FeedItemDto): QueueItemDto {
  const tags = [item.category, item.slot_type, item.angle]
    .filter((t): t is string => !!t && t.length > 0)
    .filter((t) => t.toLowerCase() !== "wildcard");

  return {
    id: item.feed_event_id,
    sourceId: item.asin,
    source: "amazon",
    title: item.title,
    imageUrl: item.image_url || null,
    priceCents: item.price > 0 ? Math.round(item.price * 100) : null,
    currency: item.price > 0 ? "USD" : null,
    buyUrl: item.product_url || null,
    tags,
  };
}

export type InteractionKind = "like" | "pass" | "save";

export function interactionToSignal(type: InteractionKind): "skip" | "save" | "shop_now" | "dislike" {
  switch (type) {
    case "pass":
      return "skip";
    case "save":
      return "save";
    case "like":
      return "shop_now";
  }
}
