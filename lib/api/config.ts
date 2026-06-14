const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";

/** Seeded dev user on shared Supabase (see backend handoff). */
export const DEFAULT_BACKEND_USER_ID =
  "232fbb4a-cc31-466a-a7aa-18474f0b4247";

export function getGiftGeniusApiBaseUrl() {
  return process.env.EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export function getDefaultBackendUserId(): string {
  return (
    process.env.EXPO_PUBLIC_GIFTGENIUS_DEV_USER_ID?.trim() ||
    DEFAULT_BACKEND_USER_ID
  );
}

/** True when the API host is a local/LAN dev server (admin routes may be open). */
export function isLocalDevApiHost(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.")
    );
  } catch {
    return false;
  }
}
