import type { createGiftGeniusApiClient, FeedDto } from "./client";
import { getDefaultBackendUserId } from "./config";
import { cacheHobbies, ensureHobbyCatalog } from "./hobbies";
import { profileToFeedDto } from "./mappers";
import { setStoredJwt } from "@/lib/state/auth-store";
import {
  addStoredProfileId,
  getStoredBackendUserId,
  getStoredProfileIds,
  setStoredBackendUserId,
} from "@/lib/state/profile-store";
import {
  setAccessToken,
  setCurrentProfile,
  setCurrentSession,
  setCurrentUser,
} from "@/lib/state/user-context";

type ClerkUserLike = {
  id: string;
  fullName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
};

type ApiClient = ReturnType<typeof createGiftGeniusApiClient>;

export type BootstrapResult = {
  profiles: FeedDto[];
  activeProfile: FeedDto;
  sessionId: string;
};

async function resolveBackendUserId(clerkUserId: string): Promise<string> {
  const stored = await getStoredBackendUserId(clerkUserId);
  if (stored) return stored;

  const defaultId = getDefaultBackendUserId();
  await setStoredBackendUserId(clerkUserId, defaultId);
  return defaultId;
}

async function loadProfileDetails(
  api: ApiClient,
  profileIds: string[]
): Promise<FeedDto[]> {
  const profiles: FeedDto[] = [];
  for (const profileId of profileIds) {
    try {
      const detail = await api.getProfile(profileId);
      profiles.push(profileToFeedDto(detail));
      if (detail.hobbies?.length) {
        await cacheHobbies(detail.hobbies);
      }
    } catch {
      /* stale id in local storage */
    }
  }
  return profiles;
}

async function syncProfilesFromServer(
  api: ApiClient,
  backendUserId: string
): Promise<FeedDto[]> {
  try {
    const rows = await api.listProfiles();
    for (const row of rows) {
      await addStoredProfileId(backendUserId, row.id);
    }
    return loadProfileDetails(
      api,
      rows.map((row) => row.id)
    );
  } catch {
    return [];
  }
}

async function ensureDefaultProfile(
  api: ApiClient,
  backendUserId: string
): Promise<FeedDto[]> {
  const hobbies = await ensureHobbyCatalog(api);
  const createdProfile = await api.createProfile({
    label: "Default",
    hobby_ids: hobbies.slice(0, Math.min(3, hobbies.length)).map((h) => h.id),
    budget_min: 25,
    budget_max: 100,
  });
  await addStoredProfileId(backendUserId, createdProfile.id);
  const detail = await api.getProfile(createdProfile.id);
  if (detail.hobbies?.length) {
    await cacheHobbies(detail.hobbies);
  }
  return [profileToFeedDto(detail)];
}

export async function bootstrapFromClerkUser(
  api: ApiClient,
  clerkUser: ClerkUserLike
): Promise<BootstrapResult> {
  const email = clerkUser.primaryEmailAddress?.emailAddress?.trim();
  if (!email) {
    throw new Error("Your Clerk account needs an email address to use GiftGenius.");
  }

  const backendUserId = await resolveBackendUserId(clerkUser.id);

  const { token } = await api.exchangeToken(backendUserId);
  await setStoredJwt(token);
  setAccessToken(token);
  setCurrentUser(backendUserId);

  let profiles = await syncProfilesFromServer(api, backendUserId);

  if (profiles.length === 0) {
    const profileIds = await getStoredProfileIds(backendUserId);
    profiles = await loadProfileDetails(api, profileIds);
  }

  if (profiles.length === 0) {
    profiles = await ensureDefaultProfile(api, backendUserId);
  }

  if (profiles.length === 0) {
    throw new Error("Could not load any profiles. Try creating a new feed person.");
  }

  const activeProfile = profiles[0];
  setCurrentProfile(activeProfile.id);

  const session = await api.createSession(activeProfile.id, "just_because");
  setCurrentSession(session.id);

  return {
    profiles,
    activeProfile,
    sessionId: session.id,
  };
}

export async function loadProfilesForUser(
  api: ApiClient,
  backendUserId: string
): Promise<FeedDto[]> {
  const fromServer = await syncProfilesFromServer(api, backendUserId);
  if (fromServer.length > 0) return fromServer;

  const profileIds = await getStoredProfileIds(backendUserId);
  return loadProfileDetails(api, profileIds);
}

export async function startSessionForProfile(
  api: ApiClient,
  profileId: string,
  occasion = "just_because"
): Promise<string> {
  const session = await api.createSession(profileId, occasion);
  setCurrentSession(session.id);
  setCurrentProfile(profileId);
  return session.id;
}

export async function hydrateBackendSession(
  api: ApiClient,
  clerkUserId: string
): Promise<boolean> {
  const backendUserId = await getStoredBackendUserId(clerkUserId);
  if (!backendUserId) return false;

  try {
    const { token } = await api.exchangeToken(backendUserId);
    await setStoredJwt(token);
    setAccessToken(token);
    setCurrentUser(backendUserId);
    return true;
  } catch {
    return false;
  }
}
