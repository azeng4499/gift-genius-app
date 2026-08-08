import { useUser } from "@clerk/clerk-expo";
import { DEV_CLERK_USER, DEV_MODE } from "@/lib/dev-mode";

/**
 * Like Clerk's `useUser`, but returns a stand-in user when DEV_MODE is on so
 * the app works without signing in. Use this instead of `useUser` on screens
 * that need the signed-in user.
 */
export function useAppUser() {
  const { user, isLoaded } = useUser();
  if (DEV_MODE) {
    return { user: DEV_CLERK_USER, isLoaded: true };
  }
  return { user, isLoaded };
}
