import { ApiError } from "./client";

/**
 * Convert any thrown value into a friendly, user-facing message.
 * Backend errors already carry friendly copy; this handles network/offline
 * and unexpected cases, and avoids leaking raw stack/SDK strings.
 */
export function friendlyErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "NETWORK_ERROR":
        // The timeout/abort path sets a helpful message; the generic fetch
        // failure sets the unfriendly "Network request failed".
        if (error.message && error.message !== "Network request failed") {
          return error.message;
        }
        return "Can’t reach GiftGenius. Check that you’re online and the server is running, then try again.";
      case "RATE_LIMITED":
        return "You’re going a little fast — give it a second and try again.";
      case "UNAUTHORIZED":
        return "Your session expired. Please sign in again.";
      case "FEED_UNAVAILABLE" as ApiError["code"]:
        return error.message;
      default:
        return error.message || fallback;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
