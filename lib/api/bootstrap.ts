import type { createGiftGeniusApiClient, FeedDto } from "./client";
import { profileToFeedDto } from "./mappers";
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

export async function bootstrapFromClerkUser(
  api: ApiClient,
  clerkUser: ClerkUserLike
): Promise<BootstrapResult> {
  const email = clerkUser.primaryEmailAddress?.emailAddress?.trim();
  if (!email) {
    throw new Error("Your Clerk account needs an email address to use GiftGenius.");
  }

  const displayName = clerkUser.fullName?.trim() || email.split("@")[0] || "GiftGenius User";

  let backendUserId = await getStoredBackendUserId(clerkUser.id);
  if (!backendUserId) {
    const created = await api.createAdminUser({ name: displayName, email });
    backendUserId = created.id;
    await setStoredBackendUserId(clerkUser.id, backendUserId);
  }

  const { token } = await api.exchangeToken(backendUserId);
  setAccessToken(token);
  setCurrentUser(backendUserId);

  let profileIds = await getStoredProfileIds(backendUserId);
  if (profileIds.length === 0) {
    const hobbies = await api.listHobbies();
    if (hobbies.length === 0) {
      throw new Error(
        "No hobbies in the catalog yet. Ask an admin to seed hobbies via POST /admin/hobbies."
      );
    }
    const createdProfile = await api.createProfile({
      label: "Default",
      hobby_ids: hobbies.slice(0, Math.min(3, hobbies.length)).map((h) => h.id),
      budget_min: 25,
      budget_max: 100,
    });
    await addStoredProfileId(backendUserId, createdProfile.id);
    profileIds = [createdProfile.id];
  }

  const profiles: FeedDto[] = [];
  for (const profileId of profileIds) {
    try {
      const detail = await api.getProfile(profileId);
      profiles.push(profileToFeedDto(detail));
    } catch {
      // Stale id in local storage — skip.
    }
  }

  if (profiles.length === 0) {
    throw new Error("Could not load any saved profiles. Try creating a new feed person.");
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
  const profileIds = await getStoredProfileIds(backendUserId);
  const profiles: FeedDto[] = [];
  for (const profileId of profileIds) {
    try {
      const detail = await api.getProfile(profileId);
      profiles.push(profileToFeedDto(detail));
    } catch {
      /* skip stale */
    }
  }
  return profiles;
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
