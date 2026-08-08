/**
 * Frontend "design mode".
 *
 * When ON, the app runs fully offline: every API call is served by the mock
 * client (see `lib/api/mock-client.ts`) and Clerk sign-in is bypassed so you
 * land straight on the app with a stand-in user. Use it to iterate on UI
 * without a running backend.
 *
 * Toggle with EXPO_PUBLIC_DEV_MODE in `.env.local` (gitignored):
 *   EXPO_PUBLIC_DEV_MODE=true   → design mode on
 *   (unset / anything else)     → normal, hits the real server + Clerk
 *
 * MUST be off before you build/push for real users. Restart the Expo dev
 * server after changing it — EXPO_PUBLIC_* vars are inlined at bundle time.
 */
export const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === "true";

/**
 * Stand-in Clerk user used while DEV_MODE bypasses sign-in. Shape matches the
 * fields the app actually reads off Clerk's user object.
 */
export const DEV_CLERK_USER = {
  id: "dev-user",
  fullName: "Dev Tester" as string | null,
  firstName: "Dev" as string | null,
  imageUrl: null as string | null,
  primaryEmailAddress: { emailAddress: "dev@giftgenius.local" } as
    | { emailAddress: string }
    | null,
};
