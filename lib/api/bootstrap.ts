import type { createGiftGeniusApiClient, FeedDto } from "./client";
import { cacheHobbies } from "./hobbies";
import { profileToFeedDto } from "./mappers";
import {
  addStoredProfileId,
  getStoredProfileIds,
} from "@/lib/state/profile-store";
import {
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
  /** Null when the user has no profiles yet and must complete onboarding. */
  activeProfile: FeedDto | null;
  sessionId: string | null;
  /** True when the signed-in user has no recipients and should be onboarded. */
  needsOnboarding: boolean;
};

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

/**
 * Resolve the backend user for the signed-in Clerk identity (creating it on
 * first sign-in) and load their profiles. If they have none, signal that the
 * caller should route into onboarding (we do NOT auto-create a placeholder).
 */
export async function bootstrapFromClerkUser(
  api: ApiClient,
  clerkUser: ClerkUserLike
): Promise<BootstrapResult> {
  // The backend verifies the Clerk token and maps it to a backend user.
  const { user } = await api.syncUser({
    name: clerkUser.fullName ?? undefined,
    email: clerkUser.primaryEmailAddress?.emailAddress ?? undefined,
  });
  setCurrentUser(user.id);

  let profiles = await syncProfilesFromServer(api, user.id);

  if (profiles.length === 0) {
    const profileIds = await getStoredProfileIds(user.id);
    profiles = await loadProfileDetails(api, profileIds);
  }

  // Brand-new user — let them create their first recipient themselves.
  if (profiles.length === 0) {
    setCurrentProfile(null);
    setCurrentSession(null);
    return { profiles: [], activeProfile: null, sessionId: null, needsOnboarding: true };
  }

  const activeProfile = profiles[0];
  setCurrentProfile(activeProfile.id);

  // Omit occasion → backend uses the profile's saved occasion.
  const session = await api.createSession(activeProfile.id);
  setCurrentSession(session.id);

  return {
    profiles,
    activeProfile,
    sessionId: session.id,
    needsOnboarding: false,
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
  occasion?: string
): Promise<string> {
  const session = await api.createSession(profileId, occasion);
  setCurrentSession(session.id);
  setCurrentProfile(profileId);
  return session.id;
}
