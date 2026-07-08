# Frontend ↔ Backend Integration (current)

How the Expo app (`gift-genius-app`) talks to the engine (`gift-genius-engine`).
This reflects the **current** implementation. (Older drafts described a legacy
`/feeds` API and header-based `x-user-id` auth — that is gone.)

## Base URL

- Env: `EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL` (defaults to `http://127.0.0.1:3000`)
- Resolved in `lib/api/config.ts`.

## Auth model

The app uses **Clerk** for sign-in. The backend trusts the Clerk **session JWT**
directly:

1. User signs in with Clerk (email/password or Google/Apple SSO).
2. `lib/api/token.ts` exposes a getter for the current Clerk session token.
3. The shared API client (`lib/api/index.ts → getApiClient()`) attaches it as
   `Authorization: Bearer <clerk_jwt>` on every authenticated request — fetched
   fresh per request so it never goes stale.
4. The backend verifies the token against Clerk's JWKS and maps it to a backend
   user row (created on first sign-in). `request.user.id` is the backend UUID.

`lib/api/bootstrap.ts` runs on app load:
`POST /auth/sync` (ensure backend user) → load profiles → start a session.

There is **no** backend-issued JWT and **no** shared dev user. Each Clerk user
gets their own backend account, profiles, saved items, and learned weights.

## Endpoints used

| Client method | Route |
|---|---|
| `syncUser` / `getMe` | `POST /auth/sync`, `GET /auth/me` |
| `listHobbiesAuth` | `GET /hobbies` |
| `listProfiles` / `getProfile` | `GET /profiles`, `GET /profiles/:id` |
| `createProfile` / `updateProfile` | `POST /profiles`, `PATCH /profiles/:id` |
| `createSession` | `POST /sessions` (occasion optional → profile default) |
| `getFeedBatch` | `GET /feed/:session_id?batch=N` |
| `postSignal` | `POST /feed/signal` |
| `getSavedItems` | `GET /profiles/:id/saved` |

## Swipe actions → signals

| UI action | Signal |
|---|---|
| Skip / scroll past | `skip` |
| Save (bookmark) | `save` |
| Tap "Shop this item" | `shop_now` |
| Long-press the thumbs-down | `dislike` (hides similar permanently) |

## Errors

All errors use `{ error: { code, message } }`. The client throws a typed
`ApiError`; `lib/api/errors.ts → friendlyErrorMessage()` turns it into
user-facing copy, surfaced via the toast system (`components/ui/toast.tsx`).
401s are handled by Clerk (the gate in `app/_layout.tsx` redirects to sign-in).

## Local testing without Clerk

Run the engine with `ALLOW_DEV_AUTH=true` and send `x-dev-user-id: <uuid>` to
act as a specific backend user (see `ARCHITECTURE.md`). The app itself always
uses Clerk.
