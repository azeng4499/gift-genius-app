# Clerk Authentication — Implementation Plan

This plan adds real user sign-up and sign-in to the GiftGenius Expo app using
[Clerk](https://clerk.com). It also describes how to wire Clerk tokens into the
existing `giftgenius-engine` backend so feed, interaction, and bookmark routes
become per-user instead of running on the single bundled demo user.

The plan is intentionally phased so the app stays runnable on every step.

---

## 1. Goals

- Replace the bundled `demo.user@giftgenius.local` bootstrap with real Clerk
  users.
- Use Clerk session tokens as the **Bearer token** for our existing secured
  feed routes.
- Keep our backend as the source of truth for `users`, `feeds`, `interactions`,
  `saved` — Clerk owns identity only.
- Use `expo-secure-store` so tokens survive app restarts without re-login.
- Provide sign-in, sign-up, email verification, sign-out, and a protected route
  group.

Out of scope for v1 (can ship later):

- Organizations / role-based access control.
- Social sign-in (Google, Apple). Easy to add once the email/password flow is
  live — both come from the same Clerk dashboard.
- Password reset UI (Clerk supports it; we can wire `useSignIn().resetPassword`
  later).

---

## 2. Why this approach

Clerk offers three Expo integration approaches:

| Approach            | Auth UI               | OAuth   | Expo Go works?       |
| ------------------- | --------------------- | ------- | -------------------- |
| Native components   | Native pre-built      | Native  | No (needs dev build) |
| JS + native sign-in | Custom + native OAuth | Native  | No                   |
| JavaScript          | Custom flows in RN    | Browser | Yes                  |

We currently develop in Expo Go on the LAN
(`EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL=http://10.0.0.145:3000`). The
**JavaScript** approach is the right starting point — no dev build, no native
modules to ship. If we later want native Sign in with Apple / Google, we can
upgrade to the JS + Native or Native Components path without rewriting our
screens (`useAuth`, `useSignIn`, `useSignUp` are the same in all three).

---

## 3. Architecture overview

```
┌────────────────────┐   1. Sign in/up     ┌──────────────────┐
│  Expo app (Clerk)  │ ──────────────────▶ │  Clerk service    │
│   useSignIn /      │ ◀────────────────── │  (issues JWTs)    │
│   useSignUp        │   session token     └──────────────────┘
└─────────┬──────────┘
          │ getToken()          Authorization: Bearer <clerk JWT>
          ▼
┌────────────────────┐
│ giftgenius-engine  │  verifies JWT via Clerk JWKS / CLERK_JWT_KEY,
│ (Fastify)          │  reads `sub` (Clerk user id), upserts row in
│                    │  internal `users` table, scopes feeds to that
└────────────────────┘  user.
```

Key shift on the backend: instead of issuing its own bearer in
`POST /auth/login` keyed by email, the backend now **trusts the Clerk JWT** and
links it to an internal `users` row by `clerkUserId`.

---

## 4. Frontend changes

### 4.1 Dependencies

```bash
npx expo install @clerk/clerk-expo expo-secure-store
```

We will keep using Expo Router (`expo-router`) and our existing
`src/app/` re-export bridges. No new native modules are required.

### 4.2 Environment

`.env.local`

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL=http://10.0.0.145:3000
```

The publishable key is safe to ship in the client bundle. The **secret key
never goes into the app** — only on the backend.

### 4.3 Wrap the app in `ClerkProvider`

Edit `app/_layout.tsx` to add Clerk at the root. The `src/app/_layout.tsx`
bridge keeps re-exporting the same default.

```tsx
// app/_layout.tsx
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Stack } from "expo-router";
// ...existing imports

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add it to .env.local.",
  );
}

export default function RootLayout() {
  // ...font loading
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GestureHandlerRootView className="flex-1">
        <Stack>
          {/* (auth) group is unauthenticated; everything else is protected */}
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="feed/new"
            options={{ title: "Add Feed Person" }}
          />
          <Stack.Screen
            name="feed/settings"
            options={{ title: "Feed settings" }}
          />
          <Stack.Screen
            name="bookmarks"
            options={{ title: "Bookmarked Items" }}
          />
          <Stack.Screen name="profile" options={{ title: "Profile" }} />
        </Stack>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}
```

`tokenCache` from `@clerk/clerk-expo/token-cache` uses `expo-secure-store` for
encrypted persistence.

### 4.4 Auth gating

We need two things: (a) a `(auth)` route group that holds the unauthenticated
screens, and (b) something that redirects signed-out users away from every
other screen.

```
app/
  (auth)/
    _layout.tsx     → redirects to "/" if already signed in
    sign-in.tsx
    sign-up.tsx
  index.tsx, bookmarks.tsx, profile.tsx, feed/*.tsx  ← protected screens
```

There are two ways to implement (b):

- **(a) Physical route-group move** — relocate `index.tsx`, `bookmarks.tsx`,
  `profile.tsx`, and `feed/*.tsx` under `app/(protected)/` and add a
  `(protected)/_layout.tsx` that redirects signed-out users. Clerk's docs use
  this pattern. With Expo Router, route groups are URL-invisible so links like
  `/bookmarks` keep working.
- **(b) Single `AuthGate` in the root layout** — leave every protected file
  where it is, and gate them all from one effect inside `app/_layout.tsx` that
  watches `useAuth().isSignedIn` and `useSegments()` and calls
  `router.replace(...)` when the auth state and the current route group don't
  match.

**Phase 1 uses (b).** The physical move would mean relocating five real files,
recreating five re-export bridges under `src/app/(protected)/`, and updating
`<Stack.Screen name="…">` keys in `app/_layout.tsx` — all churn for a phase
whose only goal is "stand up Clerk auth without disturbing the demo
bootstrap." We migrate to (a) in Phase 4 alongside the bootstrap rewrite.

```tsx
// app/(auth)/_layout.tsx
import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Stack } from "expo-router";

export default function AuthRoutesLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

```tsx
// app/_layout.tsx — Phase 1 AuthGate (inside <ClerkProvider>)
import { useAuth } from "@clerk/clerk-expo";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  if (!isLoaded) return null;
  return <Slot />;
}
```

`AuthGate` renders `<Slot />` so the existing `<Stack.Screen>` registrations in
the root layout still apply. In Phase 4, this is replaced by a
`(protected)/_layout.tsx` once the protected files have been moved.

### 4.5 Sign-in and sign-up screens

Custom flows with `useSignIn` and `useSignUp`. Email + password + email code
verification. Plain RN + NativeWind so the UI matches our existing forms (use
the `LabeledFeedField` component as a template).

Minimum viable screens:

- `app/(auth)/sign-in.tsx` — email, password, submit, link to sign-up.
- `app/(auth)/sign-up.tsx` — email, password, submit; on success switches to a
  code entry state and calls `signUp.attemptEmailAddressVerification`.

Clerk-side configuration the dashboard must allow:

1. **Email address** as identifier.
2. **Password** as authentication factor.
3. **Email verification code** as a verification method.

### 4.6 Replace `lib/state/user-context.ts` access token

`user-context.ts` currently stores a backend-issued bearer. Two changes:

1. Drop `accessToken` and the manual `loginWithEmail` flow. We'll read the
   Clerk token on demand instead.
2. Keep `userId` and `feedId` as **internal** identifiers returned by our
   backend after it upserts the Clerk user.

Add a tiny helper that returns the current Clerk JWT:

```ts
// lib/api/token.ts
import { useAuth } from "@clerk/clerk-expo";

let getClerkTokenRef: (() => Promise<string | null>) | null = null;

export function registerClerkTokenGetter(fn: () => Promise<string | null>) {
  getClerkTokenRef = fn;
}

export async function getClerkToken(): Promise<string | null> {
  if (!getClerkTokenRef) return null;
  return getClerkTokenRef();
}
```

Then bind it once at the root from a tiny component inside `ClerkProvider`:

```tsx
// app/_layout.tsx (inside <ClerkProvider>)
function BindToken() {
  const { getToken } = useAuth();
  useEffect(() => {
    registerClerkTokenGetter(() => getToken({ template: "default" }));
  }, [getToken]);
  return null;
}
```

### 4.7 Update the API client

`lib/api/client.ts` already supports an injected `getAccessToken`. Point it at
the Clerk helper:

```ts
// before
createGiftGeniusApiClient({
  baseUrl,
  getUserId: () => getCurrentUserId(),
  getAccessToken: () => getAccessToken(), // backend-issued bearer
});

// after
import { getClerkToken } from "@/lib/api/token";
createGiftGeniusApiClient({
  baseUrl,
  getUserId: () => getCurrentUserId(),
  getAccessToken: async () => (await getClerkToken()) ?? null,
});
```

`request()` already attaches `Authorization: Bearer …` whenever
`requiresAuth: true`, so secured calls (`getNext`, `postInteraction`,
`deleteInteraction`, `getSaved`, `updateFeed`) work unchanged.

> Note: `getAccessToken` in our client returns a string today. We'll widen its
> type to `string | null | Promise<string | null>` so it can be async without
> changing the rest of the call sites. Adjust `request()` to `await` it.

### 4.8 Bootstrap rewrite on `app/index.tsx`

Replace `bootstrapUserAndFeed`:

- **Before:** `getUsers` → find/create demo → `loginWithEmail` →
  `setAccessToken`.
- **After:**
  1. Wait for `useUser` from Clerk.
  2. Call `GET /me` (new backend route) which uses the Clerk JWT to upsert
     a row in our internal `users` table keyed by `clerkUserId` and returns
     `{ user: UserDto, feeds: FeedDto[] }`.
  3. `setCurrentUser(user.id)` and pick / create a default feed exactly like
     today.
  4. Run `resetAndLoadFeedCards`.

This keeps all current state machinery (`hasBootstrappedRef`, queue handling,
`reconnectKey`) intact.

### 4.9 Sign-out flow and the profile screen

Sign-out is a single action surface on `app/profile.tsx`, not its own route.
The current screen has a **Clear and reconnect session** demo control that
calls `clearUserContext()` and re-runs the demo bootstrap; that gets replaced
by a real **Sign out** button.

#### 4.9.1 API and side-effects we rely on

We use the `signOut` method from `useClerk()` (equivalent to the one returned
by `useAuth()`):

```ts
import { useClerk } from "@clerk/clerk-expo";
const { signOut } = useClerk();
await signOut();           // signs out every session on this client
await signOut(sessionId);  // signs out one specific session (multi-session apps)
```

What `signOut()` does for us, in order:

1. Calls Clerk's Frontend API to invalidate the active session server-side.
2. Clears Clerk's in-memory SDK state — `isSignedIn` flips to `false`.
3. Removes the stored session JWT from `expo-secure-store` via the
   `tokenCache` that we wired up in §4.3. (Earlier `@clerk/clerk-expo`
   versions had a bug where this didn't happen automatically; current
   versions delete the JWT before the SDK fires the `signedOut` event. If
   you're on `@clerk/clerk-expo < 2.19`, upgrade before relying on this.)

What `signOut()` does **not** do, and we have to handle ourselves:

- It doesn't touch our `lib/state/user-context.ts` singleton (`userId`,
  `feedId`, `accessToken`). Stale `userId` would leak to the next signed-in
  user if we skip this.
- It doesn't navigate. Our root-level `AuthGate` (see §4.4 / Phase 1) sees
  `isSignedIn === false` and replaces the route to `/(auth)/sign-in` on
  the next render. Calling `router.replace` from the sign-out handler is
  redundant and can race the gate — leave it out.

#### 4.9.2 Replace the demo control with a Sign out row

Drop these from `app/profile.tsx`:

- The `onReconnectDemo` handler and its `Alert.alert`.
- The **Clear and reconnect session** pressable under "Demo toolkit".
- The amber **No active session** banner (with `AuthGate` in place, profile
  is unreachable while signed out — the banner is dead UI).
- The `api.getUsers()` lookup inside `reload` (Phase 4 swaps user data to
  Clerk's `useUser()`; until then it's fine, but plan to remove the call
  in this PR alongside the sign-out work to keep one diff per concern).

Add a single Sign out row in its place:

```tsx
// app/profile.tsx (inside the Demo toolkit / footer area)
import { useClerk } from "@clerk/clerk-expo";
import { Alert, Pressable, Text, View, ActivityIndicator } from "react-native";
import { useState } from "react";
import { clearUserContext } from "@/lib/state/user-context";

function SignOutRow() {
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  const confirmSignOut = () => {
    Alert.alert(
      "Sign out?",
      "You'll need to sign back in to access your feeds.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: handleSignOut,
        },
      ],
    );
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // Drop local app state first so the AuthGate redirect doesn't briefly
      // remount the demo bootstrap with the old userId still set.
      clearUserContext();
      await signOut();
      // AuthGate handles the redirect to /(auth)/sign-in.
    } catch (err) {
      // signOut failed (e.g. offline). Clerk has already cleared local state
      // optimistically, so AuthGate will still bounce us. Surface a hint.
      const message = err instanceof Error ? err.message : "Sign out failed";
      Alert.alert("Sign out had an issue", message);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Pressable
      onPress={confirmSignOut}
      disabled={signingOut}
      className="flex-row items-center justify-between py-4 active:bg-zinc-50"
      style={{ opacity: signingOut ? 0.6 : 1 }}
    >
      <View className="mr-4 flex-1 shrink">
        <Text className="text-base font-medium text-red-700">Sign out</Text>
        <Text className="mt-0.5 text-sm text-zinc-500">
          Ends your session and clears tokens on this device.
        </Text>
      </View>
      {signingOut ? <ActivityIndicator color="#7f1d1d" /> : null}
    </Pressable>
  );
}
```

Cleanup order matters: clear the local context **before** awaiting
`signOut()`. If you reverse it, `isSignedIn` flips to `false` while
`getCurrentUserId()` still returns the old id, and the gate may briefly
re-mount `app/index.tsx` with stale state before settling on the auth route.

#### 4.9.3 Identity display in the profile screen

Once `signOut` exists, replace the "Demo profile" header with Clerk's user
data:

```tsx
import { useUser } from "@clerk/clerk-expo";

const { user } = useUser();

// header
<Text className="font-noto-serif-bold text-xl text-zinc-900">
  {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
</Text>
{user?.primaryEmailAddress ? (
  <ThemedText className="mt-1 text-sm text-zinc-500">
    {user.primaryEmailAddress.emailAddress}
  </ThemedText>
) : null}
```

If you want an avatar, `user?.imageUrl` from Clerk is a stable HTTPS URL
that works in `<Image source={{ uri: user.imageUrl }} />`. Keep the existing
`CircleUserRound` lucide fallback for users without an uploaded image.

Keep the internal `userId` + current feed rows in place — they're useful
debug context for support. The "Signed in: Yes (Bearer)" row goes away once
Phase 4 drops the local access token; until then it's accurate.

#### 4.9.4 What we are deliberately NOT building yet

- **A dedicated `/sign-out` route.** Clerk's docs recommend sign-out as a
  button, not a page, because the user sees it for ~200ms before the gate
  redirects. A page just adds a flicker and one more file to maintain.
  We can add `app/sign-out.tsx` later if we ever need a deep-linkable
  sign-out URL (e.g. for "log out everywhere" emails).
- **Multi-session UI.** Clerk supports multiple concurrent sessions on the
  same client. Our app is single-session, so we call `signOut()` with no
  argument (signs out all sessions, which in practice is the one active
  session). If we ever add an "Switch account" feature, we'd revisit this
  to call `signOut(session.id)` for individual sessions.
- **Forced sign-out from a 401.** Our API client currently treats 401 as
  a generic error. Phase 5 polish: detect `ApiError.code === "UNAUTHORIZED"`
  in `request()` and call `clerk.signOut()` automatically so a revoked
  server-side session immediately routes the user to sign-in. Until then,
  the user will see error UI and can sign out manually from profile.

#### 4.9.5 Manual test plan (gets added to §8 once shipped)

1. Sign in as user A. Confirm profile shows A's email.
2. Tap **Sign out** → confirm dialog → tap **Sign out**.
3. App lands on `/(auth)/sign-in`. No spinner stuck on profile.
4. Reopen Expo Go (or relaunch the binary) — app still lands on sign-in.
   This proves the JWT was cleared from `expo-secure-store`.
5. Sign in as user B. Profile shows B's email; no leftover A `userId` or
   `feedId` in the debug rows.
6. Airplane mode + tap sign out → see the "Sign out had an issue" alert,
   but app still ends up on sign-in (local state is cleared
   optimistically).

### 4.10 Social sign-in (Google + Apple) — Phase 5 expansion

When we expand beyond email/password, we add **Continue with Google** and
**Continue with Apple** buttons to `app/(auth)/sign-in.tsx` and
`app/(auth)/sign-up.tsx`. Both providers go through the same hook, so it's
one implementation reused twice.

#### 4.10.1 Approach: browser-based `useSSO`

Stays on the **JavaScript / browser** approach we chose in §2, so the app
keeps running in Expo Go. The hook is `useSSO` from `@clerk/clerk-expo`
(`useOAuth` is `@deprecated` in the same package; we use `useSSO`).

The flow:

```
tap "Continue with Google"
  → useSSO().startSSOFlow({ strategy: "oauth_google", redirectUrl })
    → expo-web-browser opens system browser at Clerk's OAuth URL
      → Google sign-in page → user consents
        → Clerk catches the OAuth callback server-side
          → browser redirects back to the app via `giftgeniusapp://oauth-callback`
            → startSSOFlow resolves with { createdSessionId, setActive, … }
              → setActive({ session: createdSessionId })
                → AuthGate sees isSignedIn=true, replaces to "/"
```

Apple sign-in is identical with `strategy: "oauth_apple"`. No native UI
sheet, no app rebuild, no extra native modules beyond what we already
have (`expo-web-browser`, `expo-auth-session`, `expo-crypto`,
`expo-linking` — all shipped in Phase 1).

#### 4.10.2 Prerequisites — Clerk dashboard

1. **Social Connections → Google → enable.** Clerk's dev instance has
   shared OAuth credentials, so this works immediately for development.
   For production: create a Google Cloud OAuth 2.0 Client ID and paste its
   Client ID + Secret into Clerk. Authorized redirect URI is the one Clerk
   shows on the configuration page (looks like
   `https://wealthy-flamingo-42.clerk.accounts.dev/v1/oauth_callback`).
2. **Social Connections → Apple → enable.** Same flow. Production needs an
   Apple Developer account, a Services ID, and a private key from
   [developer.apple.com](https://developer.apple.com). Clerk's docs walk
   through it; budget ~30 minutes the first time.
3. **Allowed origins / redirect schemes.** Add `giftgeniusapp://` to
   Clerk's allowed redirect URIs (Dashboard → Native Applications →
   Authorized redirect URLs). Expo Go's dev scheme `exp://` is allowed by
   Clerk by default for `pk_test_` instances.

`app.json` already has `"scheme": "giftgeniusapp"` from the original Expo
setup, so the deep-link side is ready.

#### 4.10.3 Code — a shared `SsoButton` and two consumers

New file at `components/auth/sso-button.tsx` (not inside `app/(auth)/`,
because Expo Router would register any non-`_layout` file there as a
route). Skeleton:

```tsx
// components/auth/sso-button.tsx
import { useSSO } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";

// MUST run at module top so the browser session completes correctly when
// the user is bounced back via the deep link.
WebBrowser.maybeCompleteAuthSession();

type Strategy = "oauth_google" | "oauth_apple";

export function SsoButton({
  strategy,
  label,
  onError,
}: {
  strategy: Strategy;
  label: string;
  onError?: (message: string) => void;
}) {
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    setBusy(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        // Use Expo Linking so this works in both Expo Go (`exp://…`) and
        // a future production binary (`giftgeniusapp://oauth-callback`).
        redirectUrl: Linking.createURL("oauth-callback"),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // AuthGate handles routing to "/"
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sign-in was cancelled.";
      onError?.(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="rounded-md border border-zinc-300 px-4 py-3"
      style={{ opacity: busy ? 0.6 : 1 }}
    >
      {busy ? (
        <ActivityIndicator color="#18181b" />
      ) : (
        <Text className="text-center text-zinc-900">{label}</Text>
      )}
    </Pressable>
  );
}
```

Drop it into the existing email/password forms, above the divider:

```tsx
// app/(auth)/sign-in.tsx (additive — keeps useSignIn flow intact)
import { SsoButton } from "@/components/auth/sso-button";

// inside the screen body, above the email input:
<View className="gap-2">
  <SsoButton strategy="oauth_apple"  label="Continue with Apple"  onError={setError} />
  <SsoButton strategy="oauth_google" label="Continue with Google" onError={setError} />
</View>
<View className="my-2 flex-row items-center gap-2">
  <View className="h-px flex-1 bg-zinc-200" />
  <Text className="text-xs uppercase tracking-wide text-zinc-400">or</Text>
  <View className="h-px flex-1 bg-zinc-200" />
</View>
```

Same two buttons + divider on `sign-up.tsx`. `useSignUp`'s email-code flow
stays untouched for users who pick the email path.

#### 4.10.4 App Store rule 4.8 — Apple sign-in is non-optional on iOS

If we ship **any** third-party social sign-in on iOS (Google, Facebook,
Microsoft, etc.), Apple's [App Store Review Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple)
requires **Sign in with Apple** as an equivalent option. The
browser-based `oauth_apple` strategy in `useSSO` satisfies this
requirement — Apple accepts the OAuth web flow for compliance. It's not
the most polished UX (browser sheet vs. native Face ID prompt), but it
ships from Expo Go without a dev build.

We can ship browser-based Apple first, then optionally upgrade to the
native UI (§4.10.5) once we're committing to dev builds anyway.

Android has no equivalent requirement, so Apple is iOS-only by display
order: hide the Apple button on Android via `Platform.OS === "ios"`
unless we want a consistent button stack across both platforms (no harm
in keeping it shown on Android — Clerk's OAuth flow still works).

#### 4.10.5 Upgrade path to native UI (later, requires dev build)

Currently we keep using browser-based OAuth because it's the only path
that works in Expo Go. Two upgrade tiers when we eventually move to a dev
build:

1. **Native Sign in with Apple** — install `expo-apple-authentication` +
   keep `expo-crypto` (we already have it), then call the
   `useSignInWithApple` hook that `@clerk/clerk-expo` ships
   (`node_modules/@clerk/clerk-expo/dist/hooks/useSignInWithApple.js`).
   That uses Apple's native ASAuthorizationController under the hood,
   no browser. Google can stay browser-based.
2. **Native components for everything** — migrate from
   `@clerk/clerk-expo` to `@clerk/expo` (the new package) and use
   `<AuthView mode="signInOrUp" />` from `@clerk/expo/native`. SwiftUI on
   iOS, Jetpack Compose on Android. Requires SDK 53+, which we already
   meet (SDK 54). Replaces our custom email/password screens entirely,
   so this is a bigger lift — not worth doing just for OAuth, but worth
   it if we want the native UX across the whole auth flow.

Both upgrades preserve `useAuth`, `useUser`, `signOut`, the AuthGate, and
all of Phase 2's token wiring. The only thing that changes is what
renders the sign-in screen.

#### 4.10.6 Manual test plan additions

Append to §8:

- **Google happy path**: tap Continue with Google on sign-in → consent in
  browser → land on `/`. Confirm `useUser().externalAccounts` lists the
  Google account.
- **Apple happy path** (iOS only): same, with Continue with Apple.
- **Cancel browser**: tap Google → close browser sheet without signing
  in → returns to sign-in screen with no error toast (cancellation isn't
  an error).
- **Cross-flow continuity**: sign up with email/password, sign out, sign
  in again with the same email via Google → Clerk should link the
  accounts automatically if the verified email matches. If linking is
  off in the dashboard, expect a "this email is already in use" error
  surfaced from `startSSOFlow`.
- **Existing demo session**: after signing in via OAuth, confirm the
  demo bootstrap on `/` still loads (until Phase 4 cuts it over to
  `GET /me`).

---

## 5. Backend changes (`giftgenius-engine`)

These belong in the backend repo but are listed here so the frontend rollout
isn't blocked.

### 5.1 Verify Clerk JWTs

Two equivalent options, pick one:

- **Networkless (recommended)**: store the PEM public key from the Clerk
  dashboard in `CLERK_JWT_KEY` and use `@clerk/backend`'s `verifyToken`:

  ```ts
  import { verifyToken } from "@clerk/backend";

  const decoded = await verifyToken(bearer, {
    jwtKey: process.env.CLERK_JWT_KEY,
    authorizedParties: ["giftgenius-app"], // optional but recommended
  });
  ```

- **JWKS network call**: `verifyToken(bearer, { secretKey: process.env.CLERK_SECRET_KEY })`.

Add a Fastify preHandler that reads `Authorization: Bearer …`, runs
`verifyToken`, and sets `request.auth = { clerkUserId: decoded.sub }`. Apply it
to every existing feed-scoped route.

### 5.2 `users` table changes

Add a `clerk_user_id` (text, unique, indexed) column. Keep the existing
internal `id` (int) so existing rows in `feeds`, `interactions`, `saved` keep
working.

Backfill / migration plan:

- Existing demo user can stay as a fixture but should be ignored when the JWT
  has a different `sub`.
- A new `POST /me/bootstrap` (or `GET /me`) upserts on `clerk_user_id` and
  returns the internal user row.

### 5.3 New / changed routes

- `GET /me` — Clerk-authed. Upserts the row, returns `{ user, feeds }`.
- All existing `/feeds/:id/...` routes drop the manual `x-user-id` reliance
  and use `request.auth.clerkUserId` to look up the owning internal user
  (`users.where(clerk_user_id = …)`), then enforce ownership.
- `POST /auth/login` is removed (or returns 410 Gone for a release or two).

### 5.4 CORS

Add the LAN dev origin to allowed CORS origins. Clerk doesn't change CORS, but
removing `x-user-id` means we no longer need to send that header.

---

## 6. Phased rollout

Each phase leaves the app in a working state.

### Status snapshot (last updated: 2026-05-25)

| Phase | Status            | Notes                                                                |
| ----- | ----------------- | -------------------------------------------------------------------- |
| 0     | **[done]**        | Clerk app created, `pk_test_…` in `.env.local`.                      |
| 1     | **[done]**        | Frontend shell shipped; demo bootstrap still active.                 |
| 2     | **[done]**        | Token helper + async client wired; no call sites switched over yet.  |
| 3     | **[not started]** | Backend work in `giftgenius-engine`. Blocks Phase 4.                 |
| 4     | **[blocked]**     | Waits on Phase 3 (`GET /me`, `verifyToken`).                         |
| 5     | **[partial]**     | Social sign-in + password reset shipped. 401 sign-out / email change pending. |

### Phase 0 — Prep (no user-visible change) — **[done]**

1. Create a Clerk application in the dashboard. **[done]**
2. Enable **Native API** (required for `@clerk/clerk-expo`). **[done]**
3. Enable **email + password** and **email code** verification. **[done]**
4. Copy publishable key into `.env.local`. **[done]** —
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_d2VhbHRoeS1mbGFtaW5nby00Mi5jbGVyay5hY2NvdW50cy5kZXYk`
   (development instance).

### Phase 1 — Frontend Clerk shell, mock backend — **[done]**

1. Install `@clerk/clerk-expo` and `expo-secure-store`. **[done]** — also
   pinned `expo-crypto@~15.0.9` and `expo-auth-session@~7.0.11` at top level
   to fix a transitive `ExpoCryptoAES` native-module mismatch (Clerk's loose
   peer ranges pulled in v56 packages that target a future Expo SDK).
2. Add `ClerkProvider` + `tokenCache` in `app/_layout.tsx`. **[done]**
3. Create `(auth)/_layout.tsx`, `(auth)/sign-in.tsx`, `(auth)/sign-up.tsx`.
   **[done]** — plus matching `src/app/(auth)/` bridges
   (`_layout.tsx`, `sign-in.tsx`, `sign-up.tsx`).
4. Add the `AuthGate` component (§4.4 option b) in `app/_layout.tsx`. Protected
   files stay where they are — no physical move in this phase. **[done]**
5. Keep the backend as-is and **temporarily** continue using the demo
   bootstrap so feeds still load. This lets us validate the auth UX
   independently. **[done]**

### Phase 2 — Wire Clerk JWT into the API client — **[done]**

1. Add `lib/api/token.ts` + `BindToken` component. **[done]** — `BindToken`
   lives next to `AuthGate` inside `<ClerkProvider>` and registers
   `() => (await getToken()) ?? null` once.
2. Widen `getAccessToken` in `lib/api/client.ts` to support async returns.
   **[done]** — `AccessTokenValue | Promise<AccessTokenValue>`; `request()`
   awaits the call.
3. Confirm secured routes still work (the backend will accept the demo
   token until we cut it over). **[done]** — no call sites point at
   `getClerkToken` yet; all three still pass the demo bearer.

### Phase 3 — Backend integration — **[not started]**

> Lives in the `giftgenius-engine` repo, not this one.

1. Implement `verifyToken` + `GET /me` in `giftgenius-engine`.
2. Add migration to add `clerk_user_id` to `users`.
3. Switch protected routes to use `request.auth.clerkUserId`.

### Phase 4 — Frontend cutover — **[blocked on Phase 3]**

1. Replace `bootstrapUserAndFeed` to call `GET /me` instead of
   `getUsers + loginWithEmail`.
2. Remove `accessToken` plumbing from `lib/state/user-context.ts` (keep
   `userId` + `feedId`).
3. **[done]** Replace the **Clear and reconnect** profile action with
   **Sign out** per §4.9 — `useClerk().signOut()` + `clearUserContext()` +
   rely on `AuthGate` for the redirect. The dead "No active session"
   banner was dropped, the `api.getUsers()` lookup in `reload` was
   removed, and §4.9.3 shipped: header now shows Clerk's `useUser()`
   identity (`fullName` / `primaryEmailAddress` / `imageUrl` avatar)
   with a `CircleUserRound` fallback.
4. Delete `POST /auth/login` usage everywhere on the frontend.
5. Physically move protected screens into `app/(protected)/` (and recreate the
   matching `src/app/(protected)/` bridges); replace `AuthGate` in
   `app/_layout.tsx` with a `(protected)/_layout.tsx` that uses `<Redirect>`.

### Phase 5 — Polish — **[partial]**

- **[done]** Social sign-in (Google + Apple) via browser-based `useSSO` —
  see §4.10. App Store rule 4.8 satisfied; native UI upgrade deferred.
- **[done]** Password reset via `useSignIn().create({ strategy: "reset_password_email_code" })`
  + `attemptFirstFactor` two-step flow. New screen at
  `app/(auth)/forgot-password.tsx`; "Forgot password?" link under the
  password field on sign-in. Reuses Clerk-managed code email, no
  custom-email backend.
- Email change in `profile.tsx` via `useUser().createEmailAddress`.
- Optional: organizations / shared feeds (Clerk Organizations).
- Auto sign-out on 401 from `request()` (see §4.9.4).

---

## 7. File-by-file checklist

Status legend: `[done]` shipped, `[pending]` not yet, `[partial]` partly done
with remaining work called out, `[blocked]` waiting on another phase.

```
app/_layout.tsx             [done]     ClerkProvider + AuthGate (Phase 1) + BindToken (Phase 2)
app/(auth)/_layout.tsx      [done]     headerless Stack; redirects live in root AuthGate
app/(auth)/sign-in.tsx      [done]     useSignIn email+password + <SsoButton> Apple/Google (§4.10) + Forgot password link
app/(auth)/sign-up.tsx      [done]     useSignUp + email-code + <SsoButton> in non-verification branch
app/(auth)/forgot-password.tsx [done]  reset_password_email_code two-step flow (Phase 5)
app/(protected)/_layout.tsx [pending]  Phase 4: replaces AuthGate once protected files move
components/auth/sso-button.tsx [done]  shared <SsoButton strategy="oauth_apple|oauth_google" /> (§4.10)
app/index.tsx               [pending]  Phase 4: bootstrap via GET /me, drop loginWithEmail
app/profile.tsx             [done]     Sign out (§4.9.2) + useUser header (§4.9.3); api.getUsers() removed

lib/api/client.ts           [partial]  Phase 2 widened getAccessToken to async; Phase 4 drops loginWithEmail
lib/api/token.ts            [done]     registerClerkTokenGetter / getClerkToken
lib/state/user-context.ts   [pending]  Phase 4: remove accessToken; keep userId / feedId

src/app/(auth)/_layout.tsx  [done]     re-export bridge
src/app/(auth)/sign-in.tsx  [done]     re-export bridge
src/app/(auth)/sign-up.tsx  [done]     re-export bridge
src/app/(auth)/forgot-password.tsx [done] re-export bridge

.env.local                  [done]     EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

package.json                [done]     +@clerk/clerk-expo, +expo-secure-store, +expo-crypto, +expo-auth-session
app.json                    [done]     expo-secure-store config plugin auto-added
```

Backend (separate repo, all blocked on Phase 3):

```
users migration             [pending]  add clerk_user_id unique index
clerk auth plugin           [pending]  verifyToken middleware
routes/me.ts                [pending]  GET /me upserts + returns user/feeds
routes/feeds.ts             [pending]  use request.auth.clerkUserId
routes/auth.ts              [pending]  drop /auth/login (or 410)
```

---

## 8. Testing plan

- **Manual happy path**: sign-up with a new email, receive code, verify,
  land on `/`, see your own (empty) feed, add a feed, swipe.
- **Manual sign-out**: profile → Sign out, app returns to `/(auth)/sign-in`,
  token cleared from secure store.
- **Token refresh**: leave the app open >1 hour (default Clerk session
  lifetime), make a swipe — `getToken()` should silently issue a fresh JWT
  via the cached refresh token.
- **Two-user isolation**: sign up as user A, save an item, sign out, sign up
  as user B, confirm B's `/bookmarks` is empty.
- **Backend rejection**: send a request with a tampered `Authorization`
  header, expect `401 UNAUTHORIZED`.
- **Lint**: `npm run lint` should still pass after the cutover (no new
  warnings beyond existing `newFeedName` / `creatingFeed` dead-state ones,
  which we can clean up in the same PR).

---

## 9. Risks and mitigations

| Risk                                                | Mitigation                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `expo-secure-store` not available in Expo Go on web | We only target iOS/Android in Expo Go; web is not a release target.                                                  |
| Token expiry mid-request                            | `getToken()` returns a fresh one each call; client always pulls before sending.                                      |
| Backend rollout lags frontend                       | Phase 1+2 keep the demo flow alive; cutover happens in Phase 4 only after backend ships `GET /me`.                   |
| User leaks across devices                           | Clerk handles session per-device; sign-out wipes secure storage.                                                     |
| Stale `userId` in `user-context.ts` after sign-out  | `useEffect` on `useAuth().isSignedIn` clears `userId/feedId` and forces a re-bootstrap.                              |
| Need org-scoped feeds later                         | Clerk Organizations slot in here without rewriting auth — we'd add `orgId` to feeds, not change the JWT verify path. |

---

## 10. Open questions to confirm before starting

1. ~~Production identity strategy — email/password only, or do we want social
   sign-in (Google/Apple) at launch? Choosing now affects whether we ship a
   dev build for Phase 1.~~ **Resolved (2026-05-25):** ship Phase 1 with
   email/password only; add browser-based Google + Apple via `useSSO` as
   Phase 5 polish (no dev build needed). Plan details in §4.10. Native UI
   upgrade deferred until we have a reason to do a dev build for other
   reasons.
2. Do we keep `EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL` for production or move to
   a hosted backend URL before Clerk rollout? Auth works either way but
   determines `authorizedParties`.
3. Backend ownership — who lands the `verifyToken` middleware and
   `GET /me`? Frontend Phase 4 is blocked on that.
4. Migration path for any existing data tied to `demo.user@giftgenius.local` —
   keep, reassign, or drop?
