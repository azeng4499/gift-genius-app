import type { createGiftGeniusApiClient, FeedDto, ProfileDto } from "./client";
import { ensureHobbyCatalog } from "./hobbies";
import { profileDtoToFeedDto, profileToFeedDto } from "./mappers";
import {
  addStoredProfileId,
  getStoredProfileIds,
} from "@/lib/state/profile-store";
import {
  setCurrentProfile,
  setCurrentSession,
  setCurrentUser,
} from "@/lib/state/user-context";
import { timed } from "@/lib/diag";

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

type ProfileCache = {
  userId: string;
  feeds: FeedDto[];
};

let profileCache: ProfileCache | null = null;
let profilesInFlight: Promise<FeedDto[]> | null = null;
let profilesInFlightUserId: string | null = null;
let fetchGeneration = 0;

export function invalidateProfileCache(): void {
  profileCache = null;
  profilesInFlight = null;
  profilesInFlightUserId = null;
  fetchGeneration += 1;
}

export function getCachedProfiles(backendUserId: string): FeedDto[] | null {
  if (profileCache?.userId !== backendUserId) return null;
  return profileCache.feeds;
}

function rememberProfileIds(backendUserId: string, rows: ProfileDto[]): void {
  // A local fallback list, not something the screen waits on.
  void Promise.all(
    rows.map((row) => addStoredProfileId(backendUserId, row.id)),
  ).catch(() => {});
}

async function feedsFromStoredIds(
  api: ApiClient,
  profileIds: string[],
): Promise<FeedDto[]> {
  const details = await Promise.all(
    profileIds.map((id) => api.getProfile(id).catch(() => null)),
  );
  return details.filter((row) => row != null).map((row) => profileToFeedDto(row));
}

async function fetchProfilesFromServer(
  api: ApiClient,
  backendUserId: string,
): Promise<FeedDto[]> {
  // Started alongside the profile list rather than after it. The catalog only
  // supplies display names for the feeds, so waiting for the list first made it
  // a second serial round trip in front of the first card.
  const catalog = ensureHobbyCatalog(api).catch(() => []);

  try {
    const rows = await api.listProfiles();
    rememberProfileIds(backendUserId, rows);
    if (rows.length > 0) {
      const hobbyNameById = new Map(
        (await catalog).map((h) => [h.id, h.name] as const),
      );
      return rows.map((row) => profileDtoToFeedDto(row, hobbyNameById));
    }
  } catch {
    /* fall through to locally stored ids */
  }

  const storedIds = await getStoredProfileIds(backendUserId);
  if (storedIds.length === 0) return [];
  return feedsFromStoredIds(api, storedIds);
}

/**
 * List the user's feeds. Tab screens share one in-memory result so switching
 * people/saved/settings does not re-fetch every profile. Pass force after a
 * create/update/delete.
 */
export async function loadProfilesForUser(
  api: ApiClient,
  backendUserId: string,
  opts?: { force?: boolean },
): Promise<FeedDto[]> {
  if (!opts?.force && profileCache?.userId === backendUserId) {
    return profileCache.feeds;
  }
  if (
    !opts?.force &&
    profilesInFlight &&
    profilesInFlightUserId === backendUserId
  ) {
    return profilesInFlight;
  }

  const generation = ++fetchGeneration;
  const request = fetchProfilesFromServer(api, backendUserId).then((feeds) => {
    if (generation === fetchGeneration) {
      profileCache = { userId: backendUserId, feeds };
    }
    return feeds;
  });
  profilesInFlight = request;
  profilesInFlightUserId = backendUserId;
  try {
    return await request;
  } finally {
    if (profilesInFlight === request) {
      profilesInFlight = null;
      profilesInFlightUserId = null;
    }
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
  // Each await here is a separate round trip that blocks the first card, so they
  // are timed individually rather than as one "bootstrap" number.
  const { user } = await timed("auth/sync", () =>
    api.syncUser({
      name: clerkUser.fullName ?? undefined,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? undefined,
    }),
  );
  setCurrentUser(user.id);

  const profiles = await timed("list profiles (+ hobby catalog)", () =>
    loadProfilesForUser(api, user.id, { force: true }),
  );

  if (profiles.length === 0) {
    setCurrentProfile(null);
    setCurrentSession(null);
    return { profiles: [], activeProfile: null, sessionId: null, needsOnboarding: true };
  }

  const activeProfile = profiles[0];
  setCurrentProfile(activeProfile.id);

  const session = await timed("create session", () =>
    api.createSession(activeProfile.id),
  );
  setCurrentSession(session.id);

  return {
    profiles,
    activeProfile,
    sessionId: session.id,
    needsOnboarding: false,
  };
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
