import type {
  FeedDto,
  FeedItemDto,
  ProfileDetailDto,
  QueueItemDto,
  SavedItemDto,
} from "./client";

export type BookmarkItemDto = QueueItemDto & {
  savedAt: string | null;
};

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

function buildCardTags(...values: (string | null | undefined)[]): string[] {
  return values
    .filter((t): t is string => !!t && t.length > 0)
    .filter((t) => t.toLowerCase() !== "wildcard");
}

function cardSnapshotToQueueItem(item: {
  feed_event_id: string;
  asin: string;
  title: string;
  price: number;
  image_url: string;
  product_url: string;
  category?: string | null;
  slot_type?: string | null;
  angle?: string | null;
}): QueueItemDto {
  return {
    id: item.feed_event_id,
    sourceId: item.asin,
    source: "amazon",
    title: item.title,
    imageUrl: item.image_url || null,
    priceCents: item.price > 0 ? Math.round(item.price * 100) : null,
    currency: item.price > 0 ? "USD" : null,
    buyUrl: item.product_url || null,
    tags: buildCardTags(item.category, item.slot_type, item.angle),
  };
}

export function feedItemToQueueItem(item: FeedItemDto): QueueItemDto {
  return cardSnapshotToQueueItem(item);
}

export function savedItemToBookmarkItem(item: SavedItemDto): BookmarkItemDto {
  return {
    ...cardSnapshotToQueueItem(item),
    savedAt: item.saved_at ?? null,
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
