# Feed + Backend Integration Task Breakdown

This checklist is derived from `FRONTEND_INTEG.md` and is scoped to the end state where the feed is fully wired to the GiftGenius backend and usable end-to-end.

## Target End State

- App can connect to backend health endpoint.
- User can select/create a user and use that user context for feed-scoped calls.
- User can create/select a feed.
- Feed screen can load the next card from backend.
- Swipe actions send interactions to backend.
- Saved tab/view loads saved items from backend.
- Error handling is implemented for `401`, `403`, `404`, and `5xx`.

## Phase 0 - Foundation and Env Setup

- [ ] Confirm backend is running and reachable at `http://127.0.0.1:3000` (or configured URL).
- [ ] Add and document Expo env variable `EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL`.
- [ ] Add a single API base URL resolver:
  - `process.env.EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL ?? "http://127.0.0.1:3000"`
- [ ] Add quick connectivity check against `GET /health`.

### Acceptance Criteria

- [ ] App can successfully call `GET /health`.
- [ ] Base URL can be changed without code changes (env-only).

## Phase 1 - API Client Alignment

- [ ] Update/create API client module to match backend contract (`lib/api/client.ts` or similar).
- [ ] Add typed DTOs:
  - `UserDto`
  - `FeedDto`
  - `QueueItemDto`
- [ ] Add typed error model (`ApiError`) matching backend unified error shape.
- [ ] Implement endpoint wrappers:
  - `GET /health`
  - `GET /users`
  - `POST /users`
  - `GET /feeds?userId=<id>`
  - `POST /feeds`
  - `GET /feeds/:feedId/next` (auth)
  - `POST /feeds/:feedId/interactions` (auth)
  - `GET /feeds/:feedId/saved` (auth)
- [ ] Ensure feed-scoped routes send `x-user-id` header matching feed owner.
- [ ] Retry policy:
  - Retry idempotent GET routes with short backoff.
  - Do not retry POST mutation routes by default.

### Acceptance Criteria

- [ ] All required endpoints are callable through one typed client.
- [ ] Feed routes reject missing/invalid `x-user-id` and succeed with valid owner ID.

## Phase 2 - User Context State (Header Auth)

- [ ] Add user context state management:
  - current user
  - selected feed
  - hydrated user ID for API calls
- [ ] Add automatic `x-user-id` attach behavior for feed-scoped routes.
- [ ] Implement `401` handling for stale/missing header context:
  - clear user/feed context
  - redirect user to select-user/select-feed flow.

### Acceptance Criteria

- [ ] Selected user context is available after app load.
- [ ] App recovers gracefully from stale/invalid user context.

## Phase 3 - User and Feed Setup UX

- [ ] Build or wire user selection/create UI:
  - list users via `GET /users`
  - create user via `POST /users`
- [ ] Build or wire feed selection/create UI:
  - list feeds for selected user via `GET /feeds?userId=...`
  - create feed via `POST /feeds`
- [ ] Persist selected user and selected feed in app state.

### Acceptance Criteria

- [ ] User can create/select profile and feed without manual API calls.
- [ ] Selected feed ID is available to feed screen logic.

## Phase 4 - Feed Swipe Loop Integration

- [ ] On feed screen load, call `GET /feeds/:feedId/next` with `x-user-id`.
- [ ] Map `QueueItemDto` to UI card model (title, image, price, buy link, tags).
- [ ] On swipe action, call `POST /feeds/:feedId/interactions` with:
  - `catalogItemId`
  - `type` (`like` | `pass` | `save`)
- [ ] After interaction succeeds, fetch next card and continue loop.
- [ ] Handle queue-empty state gracefully.

### Acceptance Criteria

- [ ] Swipe actions consistently persist backend interactions.
- [ ] Feed advances through backend-provided queue.

## Phase 5 - Saved Items Integration

- [ ] Implement saved items view using `GET /feeds/:feedId/saved` (auth required).
- [ ] Render saved list from backend `items` payload.
- [ ] Add pull-to-refresh/manual refresh behavior.
- [ ] Enable open-out links using `buyUrl`.

### Acceptance Criteria

- [ ] Saved tab reflects backend state accurately after save interactions.

## Phase 6 - Error Handling and UX Hardening

- [ ] Implement unified error parsing (`{ error: { code, message } }`).
- [ ] Add user-facing behavior by status/code:
  - `401`: clear session + relogin path
  - `403`: access denied / stale feed ownership message
  - `404`: empty/not-found state
  - `5xx`: retry GETs, show generic failure UI
- [ ] Add network failure fallback states and retry affordances.

### Acceptance Criteria

- [ ] App does not crash on common backend failures.
- [ ] Error states are visible and actionable to user.

## Phase 7 - Validation and End-to-End Test Checklist

- [ ] Health check succeeds.
- [ ] User create/select succeeds and user context is stored.
- [ ] Feed create/select succeeds.
- [ ] First card loads from backend.
- [ ] `like`, `pass`, and `save` interactions return success.
- [ ] Saved items list includes recently saved card.
- [ ] Missing or mismatched `x-user-id` returns expected unauthorized/forbidden handling.
- [ ] Invalid `feedId` returns `404` state correctly.

## Suggested Implementation Order (Strict)

1. Base URL + health check  
2. API client alignment  
3. User context/header auth  
4. User + feed setup screens/state  
5. Swipe loop backend wiring  
6. Saved screen wiring  
7. Error handling polish  
8. End-to-end validation

## Deliverables

- [ ] `lib/api/client.ts` fully aligned to integration guide.
- [ ] User context state module + header auth wiring.
- [ ] User/feed setup UI flow.
- [ ] Feed screen backend integration for `next` + interactions.
- [ ] Saved view backend integration.
- [ ] Integration notes updated in README or project docs.
