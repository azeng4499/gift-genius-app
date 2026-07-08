/**
 * Single shared GiftGenius API client.
 *
 * Wired to the Clerk session token (fetched fresh per request via
 * `getClerkToken`), so every screen authenticates as the signed-in user
 * without threading tokens around. Import `getApiClient()` everywhere.
 */

import { createGiftGeniusApiClient } from "./client";
import { getGiftGeniusApiBaseUrl } from "./config";
import { getClerkToken } from "./token";

let _client: ReturnType<typeof createGiftGeniusApiClient> | null = null;

export function getApiClient() {
  if (!_client) {
    _client = createGiftGeniusApiClient({
      baseUrl: getGiftGeniusApiBaseUrl(),
      getAccessToken: () => getClerkToken(),
    });
  }
  return _client;
}

export type ApiClient = ReturnType<typeof createGiftGeniusApiClient>;
