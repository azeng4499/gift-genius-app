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

/** Map a stored backend occasion onto a form chip value for editing. */
export function fromBackendOccasion(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
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

const SLOT_LABELS: Record<string, string> = {
  occasion: "For the occasion",
  wildcard: "Something different",
  adjacent: "Related interests",
};

/**
 * Card chips — product-facing, not engine internals.
 * Priority: hobby name → occasion → soft wildcard/adjacent label.
 * Never show Amazon binding ("Paperback") or angle codes ("Gear").
 * Max 2 chips.
 */
function buildCardTags(opts: {
  hobbyName?: string | null;
  slotType?: string | null;
}): string[] {
  const tags: string[] = [];

  const hobby = opts.hobbyName?.trim();
  if (hobby) {
    tags.push(hobby);
  }

  const slot = opts.slotType?.toLowerCase() ?? "";
  if (slot === "occasion") {
    tags.push(SLOT_LABELS.occasion);
  } else if (slot === "wildcard" || slot === "adjacent") {
    tags.push(SLOT_LABELS[slot]);
  }

  return [...new Set(tags)].slice(0, 2);
}

function cardSnapshotToQueueItem(item: {
  feed_event_id: string;
  asin: string;
  title: string;
  price: number;
  image_url: string;
  product_url: string;
  slot_type?: string | null;
  hobby_name?: string | null;
  rating?: number | null;
  ratings_total?: number | null;
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
    tags: buildCardTags({
      hobbyName: item.hobby_name,
      slotType: item.slot_type,
    }),
    rating: typeof item.rating === "number" ? item.rating : null,
    ratingsCount:
      typeof item.ratings_total === "number" ? item.ratings_total : null,
  };
}

export function feedItemToQueueItem(item: FeedItemDto): QueueItemDto {
  return cardSnapshotToQueueItem(item);
}

/** Display price for a card. Canopy returns 0 for items with no buyable offer. */
export function formatPrice(
  item: Pick<QueueItemDto, "priceCents" | "currency"> | null
): string {
  if (!item || item.priceCents == null || !item.currency) {
    return "Price unavailable";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: item.currency,
  }).format(item.priceCents / 100);
}

export function savedItemToBookmarkItem(item: SavedItemDto): BookmarkItemDto {
  return {
    ...cardSnapshotToQueueItem(item),
    savedAt: item.saved_at ?? null,
  };
}

export type InteractionKind = "pass" | "save" | "shop" | "dislike";

/**
 * Interactions that leave a lasting mark on the card. "shop" is excluded — it
 * hands off to Amazon rather than recording a verdict on the item.
 */
export type AppliedInteraction = Extract<
  InteractionKind,
  "pass" | "save" | "dislike"
>;

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
