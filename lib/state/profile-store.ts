import * as SecureStore from "expo-secure-store";

function backendUserKey(clerkUserId: string) {
  return `gg_backend_user_${clerkUserId}`;
}

function profileIdsKey(backendUserId: string) {
  return `gg_profile_ids_${backendUserId}`;
}

export async function getStoredBackendUserId(
  clerkUserId: string
): Promise<string | null> {
  return SecureStore.getItemAsync(backendUserKey(clerkUserId));
}

export async function setStoredBackendUserId(
  clerkUserId: string,
  backendUserId: string
): Promise<void> {
  await SecureStore.setItemAsync(backendUserKey(clerkUserId), backendUserId);
}

export async function getStoredProfileIds(
  backendUserId: string
): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(profileIdsKey(backendUserId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export async function addStoredProfileId(
  backendUserId: string,
  profileId: string
): Promise<void> {
  const existing = await getStoredProfileIds(backendUserId);
  if (existing.includes(profileId)) return;
  await SecureStore.setItemAsync(
    profileIdsKey(backendUserId),
    JSON.stringify([...existing, profileId])
  );
}
