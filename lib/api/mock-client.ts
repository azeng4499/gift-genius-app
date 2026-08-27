/**
 * Offline mock of the GiftGenius API client, used when DEV_MODE is on.
 *
 * Returns canned data so every screen renders without a backend. State
 * (profiles, saved items) lives in memory for the session, so create/update/
 * save/unsave feel real until you reload. Keep the method signatures in sync
 * with `createGiftGeniusApiClient` — this is a drop-in replacement.
 */

import type {
  FeedItemDto,
  HealthDto,
  HobbyDto,
  ProfileDetailDto,
  ProfileDto,
  SavedItemDto,
  SavedItemsResponseDto,
  SessionDto,
  UserDto,
} from "./client";

const NOW = new Date().toISOString();

const MOCK_USER: UserDto = {
  id: "dev-user-1",
  name: "Dev Tester",
  email: "dev@giftgenius.local",
  created_at: NOW,
  updated_at: NOW,
};

const MOCK_HOBBIES: HobbyDto[] = [
  { id: "hobby-coffee", name: "Coffee", slug: "coffee" },
  { id: "hobby-hiking", name: "Hiking", slug: "hiking" },
  { id: "hobby-gaming", name: "Gaming", slug: "gaming" },
  { id: "hobby-cooking", name: "Cooking", slug: "cooking" },
  { id: "hobby-reading", name: "Reading", slug: "reading" },
  { id: "hobby-photography", name: "Photography", slug: "photography" },
  { id: "hobby-yoga", name: "Yoga", slug: "yoga" },
  { id: "hobby-music", name: "Music", slug: "music" },
];

// Canopy search results always come back with category "General" and a real
// Amazon product URL; the engine tags each item with its slot/hobby/angle.
function mockImage(seed: string): string {
  return `https://picsum.photos/seed/${seed}/600/600`;
}

function productUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}`;
}

// Mirrors the shape returned by GET /feed/:session_id (services/feed.js →
// insertFeedEvents). Invariants the real engine guarantees:
//   • interest  → hobby_id/hobby_name set, angle ∈ non-wildcard taxonomy angles
//   • wildcard  → hobby_id/hobby_name set, angle === "wildcard"
//   • adjacent  → hobby_id/hobby_name/angle all null (cross-hobby)
//   • occasion  → hobby_id/hobby_name/angle all null
//   • category is always "General"; rating is null when a product has no reviews
const MOCK_FEED_ITEMS: FeedItemDto[] = [
  {
    feed_event_id: "evt-1",
    asin: "B0MOCK0001",
    title: "Pour-Over Coffee Maker Set with Gooseneck Kettle",
    price: 48.99,
    image_url: mockImage("coffee1"),
    product_url: productUrl("B0MOCK0001"),
    category: "General",
    slot_type: "interest",
    hobby_id: "hobby-coffee",
    hobby_name: "Coffee",
    angle: "consumable",
    rating: 4.7,
    ratings_total: 1142,
    score: 0.94,
  },
  {
    feed_event_id: "evt-2",
    asin: "B0MOCK0002",
    title: "Insulated Hiking Water Bottle, 32oz",
    price: 29.5,
    image_url: mockImage("hiking2"),
    product_url: productUrl("B0MOCK0002"),
    category: "General",
    slot_type: "interest",
    hobby_id: "hobby-hiking",
    hobby_name: "Hiking",
    angle: "experience",
    rating: 4,
    ratings_total: 318,
    score: 0.88,
  },
  {
    // Adjacent (cross-hobby) items carry no hobby/angle — the card shows the
    // "Related interests" slot label only.
    feed_event_id: "evt-3",
    asin: "B0MOCK0003",
    title: "Mechanical Keyboard, Hot-Swappable RGB",
    price: 89.0,
    image_url: mockImage("gaming3"),
    product_url: productUrl("B0MOCK0003"),
    category: "General",
    slot_type: "adjacent",
    hobby_id: null,
    hobby_name: null,
    angle: null,
    rating: 4.5,
    ratings_total: 2064,
    score: 0.81,
  },
  {
    feed_event_id: "evt-4",
    asin: "B0MOCK0004",
    title: "Cast Iron Skillet, Pre-Seasoned 12-inch",
    price: 34.95,
    image_url: mockImage("cooking4"),
    product_url: productUrl("B0MOCK0004"),
    category: "General",
    slot_type: "interest",
    hobby_id: "hobby-cooking",
    hobby_name: "Cooking",
    angle: "skill",
    rating: 4.9,
    ratings_total: 15320,
    score: 0.79,
  },
  {
    // Wildcard keeps its source hobby but uses the "wildcard" angle; the product
    // itself is intentionally off-interest. Rating null exercises the
    // hidden-rating case.
    feed_event_id: "evt-5",
    asin: "B0MOCK0005",
    title: "Cozy Weighted Blanket, 15lb",
    price: 59.99,
    image_url: mockImage("wildcard5"),
    product_url: productUrl("B0MOCK0005"),
    category: "General",
    slot_type: "wildcard",
    hobby_id: "hobby-reading",
    hobby_name: "Reading",
    angle: "wildcard",
    rating: null,
    ratings_total: null,
    score: 0.6,
  },
  {
    // Occasion items carry no hobby/angle — "For the occasion" slot label only.
    feed_event_id: "evt-6",
    asin: "B0MOCK0006",
    title: "Instant Film Camera Bundle",
    price: 74.0,
    image_url: mockImage("photo6"),
    product_url: productUrl("B0MOCK0006"),
    category: "General",
    slot_type: "occasion",
    hobby_id: null,
    hobby_name: null,
    angle: null,
    rating: 3.4,
    ratings_total: 87,
    score: 0.72,
  },
];

let profileSeq = 1;

function makeProfile(overrides: Partial<ProfileDto> = {}): ProfileDto {
  const id = overrides.id ?? `dev-profile-${profileSeq++}`;
  return {
    id,
    user_id: MOCK_USER.id,
    label: "Alex (Brother)",
    hobby_ids: ["hobby-coffee", "hobby-hiking", "hobby-gaming"],
    budget_min: 25,
    budget_max: 100,
    occasion: "birthday",
    relationship: "sibling",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// In-memory stores so mutations persist for the session. Several seeded
// profiles so the feed switcher has real options to toggle between.
const profiles: ProfileDto[] = [
  makeProfile({
    id: "dev-profile-1",
    label: "Alex (Brother)",
    relationship: "sibling",
    occasion: "birthday",
    budget_min: 25,
    budget_max: 100,
  }),
  makeProfile({
    id: "dev-profile-2",
    label: "Sophia (Sister)",
    relationship: "sibling",
    occasion: "christmas",
    budget_min: 25,
    budget_max: 50,
    hobby_ids: ["hobby-reading", "hobby-yoga", "hobby-photography"],
  }),
  makeProfile({
    id: "dev-profile-3",
    label: "Mom",
    relationship: "mom",
    occasion: "mothers_day",
    budget_min: 50,
    budget_max: 150,
    hobby_ids: ["hobby-cooking", "hobby-reading"],
  }),
  makeProfile({
    id: "dev-profile-4",
    label: "Dad",
    relationship: "dad",
    occasion: "fathers_day",
    budget_min: 40,
    budget_max: 120,
    hobby_ids: ["hobby-hiking", "hobby-music"],
  }),
  makeProfile({
    id: "dev-profile-5",
    label: "Priya (Friend)",
    relationship: "friend",
    occasion: "birthday",
    budget_min: 20,
    budget_max: 60,
    hobby_ids: ["hobby-gaming", "hobby-music"],
  }),
  makeProfile({
    id: "dev-profile-6",
    label: "Grandma",
    relationship: "grandparent",
    occasion: "christmas",
    budget_min: 30,
    budget_max: 80,
    hobby_ids: ["hobby-cooking", "hobby-photography"],
  }),
  makeProfile({
    id: "dev-profile-7",
    label: "Jordan (Coworker)",
    relationship: "coworker",
    occasion: "just_because",
    budget_min: 15,
    budget_max: 40,
    hobby_ids: ["hobby-coffee"],
  }),
];
const savedByProfile: Record<string, Set<string>> = {
  "dev-profile-1": new Set(["evt-2", "evt-4"]),
  "dev-profile-2": new Set(["evt-1"]),
  "dev-profile-3": new Set(),
  "dev-profile-4": new Set(["evt-3"]),
  "dev-profile-5": new Set(),
  "dev-profile-6": new Set(),
  "dev-profile-7": new Set(),
};

// Taxonomy angles (services/taxonomy → angles.txt); the engine seeds a weight
// row for every hobby × angle pair on profile creation.
const ANGLES = [
  "consumable",
  "skill",
  "experience",
  "aesthetic",
  "social",
  "wildcard",
] as const;

function hobbiesFor(ids: string[]): HobbyDto[] {
  return MOCK_HOBBIES.filter((h) => ids.includes(h.id));
}

function toDetail(profile: ProfileDto): ProfileDetailDto {
  return {
    ...profile,
    hobbies: hobbiesFor(profile.hobby_ids),
    // GET /profiles/:id returns one weight row per hobby × angle pair.
    weights: profile.hobby_ids.flatMap((hobby_id) =>
      ANGLES.map((angle) => ({
        hobby_id,
        angle,
        weight: 1,
        cooldown_until: null,
      }))
    ),
  };
}

function feedItemToSaved(item: FeedItemDto): SavedItemDto {
  return {
    feed_event_id: item.feed_event_id,
    asin: item.asin,
    title: item.title,
    price: item.price,
    image_url: item.image_url,
    product_url: item.product_url,
    rating: item.rating ?? null,
    ratings_total: item.ratings_total ?? null,
    slot_type: item.slot_type,
    hobby_id: item.hobby_id,
    hobby_name: item.hobby_name,
    angle: item.angle,
    saved_at: NOW,
  };
}

function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Drop-in replacement for `createGiftGeniusApiClient` used in DEV_MODE. */
export function createMockApiClient() {
  return {
    async getHealth(): Promise<HealthDto> {
      return delay({ status: "ok", timestamp: NOW }, 50);
    },

    async syncUser(): Promise<{ user: UserDto }> {
      return delay({ user: MOCK_USER });
    },

    async getMe(): Promise<{ user: UserDto }> {
      return delay({ user: MOCK_USER });
    },

    async listHobbiesAuth(): Promise<HobbyDto[]> {
      return delay(MOCK_HOBBIES);
    },

    async listHobbiesAdmin(): Promise<HobbyDto[]> {
      return delay(MOCK_HOBBIES);
    },

    async listHobbies(): Promise<HobbyDto[]> {
      return delay(MOCK_HOBBIES);
    },

    async listProfiles(): Promise<ProfileDto[]> {
      return delay(profiles.slice());
    },

    async createProfile(payload: {
      label: string;
      hobby_ids: string[];
      budget_min: number;
      budget_max: number;
      occasion?: string;
      relationship?: string | null;
    }): Promise<ProfileDto> {
      const profile = makeProfile({
        label: payload.label,
        hobby_ids: payload.hobby_ids,
        budget_min: payload.budget_min,
        budget_max: payload.budget_max,
        occasion: payload.occasion ?? "just_because",
        relationship: payload.relationship ?? null,
      });
      profiles.push(profile);
      savedByProfile[profile.id] = new Set();
      return delay(profile);
    },

    async getProfile(profileId: string): Promise<ProfileDetailDto> {
      const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];
      return delay(toDetail(profile));
    },

    async updateProfile(
      profileId: string,
      payload: {
        label?: string;
        hobby_ids?: string[];
        budget_min?: number;
        budget_max?: number;
        occasion?: string;
        relationship?: string | null;
      }
    ): Promise<ProfileDto> {
      const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];
      Object.assign(profile, payload, { updated_at: new Date().toISOString() });
      return delay({ ...profile });
    },

    async removeInterest(
      profileId: string,
      hobbyId: string
    ): Promise<{ profile: ProfileDto; removed_hobby_id: string }> {
      const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];
      profile.hobby_ids = profile.hobby_ids.filter((id) => id !== hobbyId);
      return delay({ profile: { ...profile }, removed_hobby_id: hobbyId });
    },

    async createSession(
      profileId: string,
      occasion?: string
    ): Promise<SessionDto> {
      // Backend uses the supplied occasion, else the profile's saved occasion,
      // else "just_because".
      const profile = profiles.find((p) => p.id === profileId);
      return delay({
        id: `dev-session-${profileId}`,
        profile_id: profileId,
        occasion: occasion ?? profile?.occasion ?? "just_because",
        started_at: NOW,
        ended_at: null,
      });
    },

    async getFeedBatch(): Promise<{
      items: FeedItemDto[];
      count: number;
      preparing?: boolean;
    }> {
      return delay({
        items: MOCK_FEED_ITEMS.slice(),
        count: MOCK_FEED_ITEMS.length,
        preparing: false,
      });
    },

    async postSignal(): Promise<{ ok: true }> {
      return delay({ ok: true } as const);
    },

    async deleteSignal(): Promise<{ ok: true }> {
      return delay({ ok: true } as const);
    },

    async getSavedItems(
      profileId: string,
      limit = 50,
      offset = 0
    ): Promise<SavedItemsResponseDto> {
      const savedIds = savedByProfile[profileId] ?? new Set<string>();
      const all = MOCK_FEED_ITEMS.filter((i) =>
        savedIds.has(i.feed_event_id)
      ).map(feedItemToSaved);
      const items = all.slice(offset, offset + limit);
      return delay({
        items,
        count: items.length,
        total: all.length,
        limit,
        offset,
      });
    },

    async copySavedItem(
      _sourceProfileId: string,
      feedEventId: string,
      targetProfileId: string
    ): Promise<{ ok: true; already_saved: boolean; feed_event_id: string }> {
      const set = (savedByProfile[targetProfileId] ??= new Set());
      const already = set.has(feedEventId);
      set.add(feedEventId);
      return delay({ ok: true, already_saved: already, feed_event_id: feedEventId });
    },

    async unsaveItem(
      profileId: string,
      feedEventId: string
    ): Promise<{ ok: true }> {
      savedByProfile[profileId]?.delete(feedEventId);
      return delay({ ok: true } as const);
    },
  };
}
