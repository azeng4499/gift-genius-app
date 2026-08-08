/**
 * Single shared GiftGenius API client.
 *
 * Wired to the Clerk session token (fetched fresh per request via
 * `getClerkToken`), so every screen authenticates as the signed-in user
 * without threading tokens around. Import `getApiClient()` everywhere.
 */

import { DEV_MODE } from "@/lib/dev-mode";
import { createGiftGeniusApiClient } from "./client";
import { getGiftGeniusApiBaseUrl } from "./config";
import { createMockApiClient } from "./mock-client";
import { getClerkToken } from "./token";

export type ApiClient = ReturnType<typeof createGiftGeniusApiClient>;

let _client: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!_client) {
    // Design mode: serve everything from the in-memory mock, no server needed.
    _client = DEV_MODE
      ? (createMockApiClient() as ApiClient)
      : createGiftGeniusApiClient({
          baseUrl: getGiftGeniusApiBaseUrl(),
          getAccessToken: () => getClerkToken(),
        });
  }
  return _client;
}
