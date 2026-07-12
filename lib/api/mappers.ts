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
    relationship: profile.relationship ?? null,
    interests: profile.hobbies?.map((h) => h.name) ?? [],
    budgetMin: profile.budget_min,
    budgetMax: profile.budget_max,
    occasion: profile.occasion ?? null,
    tagWeights: {},
    createdAt: profile.created_at ?? null,
  };
}

/** Internal angle codes → friendly, shopper-facing labels. */
const ANGLE_LABELS: Record<string, string> = {
  consumable: "Supplies",
  skill: "Gear",
  experience: "Experience",
  aesthetic: "Design",
  social: "For sharing",
  // wildcard intentionally omitted — it's the "surprise" pick.
};

const SLOT_LABELS: Record<string, string> = {
  occasion: "For the occasion",
  wildcard: "Something different",
};

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Build clean, human-readable card tags. Prefers the real product category,
 * then a friendly label for the recommendation angle/slot. Drops internal
 * jargon ("interest", "adjacent", raw angle codes).
 */
function buildCardTags(
  category?: string | null,
  slotType?: string | null,
  angle?: string | null
): string[] {
  const tags: string[] = [];

  if (category && category.trim() && category.toLowerCase() !== "general") {
    tags.push(titleCase(category));
  }

  const angleLabel = angle ? ANGLE_LABELS[angle.toLowerCase()] : undefined;
  if (angleLabel) {
    tags.push(angleLabel);
  } else if (slotType && SLOT_LABELS[slotType.toLowerCase()]) {
    tags.push(SLOT_LABELS[slotType.toLowerCase()]);
  }

  // De-dupe while preserving order.
  return [...new Set(tags)];
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

export type InteractionKind = "pass" | "save" | "shop" | "dislike";

export function interactionToSignal(
  type: InteractionKind
): "skip" | "save" | "shop_now" | "dislike" {
  switch (type) {
    case "pass":
      return "skip";
    case "save":
      return "save";
    case "shop":
      return "shop_now";
    case "dislike":
      return "dislike";
  }
}
