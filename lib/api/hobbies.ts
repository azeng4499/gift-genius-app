import * as SecureStore from "expo-secure-store";

import type { createGiftGeniusApiClient, HobbyDto } from "./client";
import { getGiftGeniusApiBaseUrl, isLocalDevApiHost } from "./config";

const HOBBY_CACHE_KEY = "gg_hobby_catalog_v1";

type ApiClient = ReturnType<typeof createGiftGeniusApiClient>;

async function readCachedHobbies(): Promise<HobbyDto[] | null> {
  const raw = await SecureStore.getItemAsync(HOBBY_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (h): h is HobbyDto =>
            h &&
            typeof h.id === "string" &&
            typeof h.name === "string" &&
            typeof h.slug === "string"
        )
      : null;
  } catch {
    return null;
  }
}

export async function cacheHobbies(hobbies: HobbyDto[]): Promise<void> {
  if (hobbies.length === 0) return;
  await SecureStore.setItemAsync(HOBBY_CACHE_KEY, JSON.stringify(hobbies));
}

export async function ensureHobbyCatalog(api: ApiClient): Promise<HobbyDto[]> {
  const cached = await readCachedHobbies();
  if (cached?.length) return cached;

  try {
    const hobbies = await api.listHobbiesAuth();
    if (hobbies.length > 0) {
      await cacheHobbies(hobbies);
      return hobbies;
    }
  } catch {
    /* GET /hobbies may not be deployed yet */
  }

  if (isLocalDevApiHost(getGiftGeniusApiBaseUrl())) {
    try {
      const hobbies = await api.listHobbiesAdmin();
      if (hobbies.length > 0) {
        await cacheHobbies(hobbies);
        return hobbies;
      }
    } catch {
      /* local admin unavailable */
    }
  }

  const fromEnv = parseHobbyIdsFromEnv();
  if (fromEnv.length > 0) {
    return fromEnv;
  }

  throw new Error(
    "Could not load the hobby catalog. Deploy the latest backend (GET /hobbies) or set EXPO_PUBLIC_GIFTGENIUS_HOBBY_IDS in .env.local."
  );
}

function parseHobbyIdsFromEnv(): HobbyDto[] {
  const raw = process.env.EXPO_PUBLIC_GIFTGENIUS_HOBBY_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => ({ id, name: id.slice(0, 8), slug: id.slice(0, 8) }));
}

export function matchHobbyIds(
  interestTokens: string[],
  hobbies: HobbyDto[]
): string[] {
  const matched: string[] = [];
  for (const token of interestTokens) {
    const key = token.toLowerCase();
    const hit =
      hobbies.find((h) => h.name.toLowerCase() === key) ??
      hobbies.find((h) => h.slug.toLowerCase() === key) ??
      hobbies.find((h) => h.name.toLowerCase().includes(key));
    if (hit && !matched.includes(hit.id)) {
      matched.push(hit.id);
    }
  }
  return matched;
}
