const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";

export function getGiftGeniusApiBaseUrl() {
  return process.env.EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}
