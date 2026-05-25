/**
 * Bridge between Clerk's React-only `useAuth().getToken` and the non-React
 * `createGiftGeniusApiClient` factory.
 *
 * `BindToken` (in `app/_layout.tsx`) calls `registerClerkTokenGetter` once
 * inside `<ClerkProvider>`. After that, any module can call
 * `getClerkToken()` to fetch a fresh Clerk session JWT without holding a
 * React hook context.
 */

type ClerkTokenGetter = () => Promise<string | null>;

let getClerkTokenRef: ClerkTokenGetter | null = null;

export function registerClerkTokenGetter(fn: ClerkTokenGetter) {
  getClerkTokenRef = fn;
}

export async function getClerkToken(): Promise<string | null> {
  if (!getClerkTokenRef) return null;
  return getClerkTokenRef();
}
