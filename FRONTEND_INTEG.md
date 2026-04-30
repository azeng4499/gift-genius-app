# Frontend Integration Guide (GiftGenius API)

This guide is for an agent implementing the frontend package that consumes the `giftgenius-engine` backend service.

## Goal

Integrate the frontend with the backend API so users can:
- create/select a user profile
- create/select a feed
- fetch swipe cards
- send interactions (`like`, `pass`, `save`)
- view saved items

---

## Base URL and Environment

- Local default: `http://127.0.0.1:3000`
- Configure frontend with an environment variable:
  - `EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL` (Expo)
  - or equivalent web/mobile env key

Example:

```ts
const API_BASE_URL =
  process.env.EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL ?? "http://127.0.0.1:3000";
```

---

## Authentication Model

The backend now supports token-based auth for feed-scoped routes.

### Login flow

1. Frontend submits an existing user email to:
   - `POST /auth/login`
2. Backend returns:
   - `accessToken`
   - `tokenType` (`Bearer`)
   - `expiresInSeconds`
   - `user`
3. Frontend stores token in secure storage (Keychain/Keystore preferred).
4. Frontend sends:
   - `Authorization: Bearer <accessToken>`
   - for feed-scoped routes.

### Auth endpoint

- `POST /auth/login`
- Body:

```json
{ "email": "api-user@example.com" }
```

- Success response:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresInSeconds": 604800,
  "user": {
    "id": 1,
    "name": "Api User",
    "email": "api-user@example.com",
    "createdAt": "2026-04-25T16:02:10.222Z"
  }
}
```

---

## Endpoints Frontend Should Use

## 1) Health
- `GET /health`
- Use for startup connectivity checks.

## 2) Users
- `GET /users`
- `POST /users`

Create user request:

```json
{
  "name": "Api User",
  "email": "api-user@example.com"
}
```

## 3) Feeds
- `GET /feeds?userId=<id>`
- `POST /feeds`

Create feed request:

```json
{
  "userId": 1,
  "name": "Mom",
  "relationship": "mom",
  "interests": ["reading", "hiking"],
  "budgetMin": 10,
  "budgetMax": 100
}
```

## 4) Swipe loop (secured)

All routes below require:
- `Authorization: Bearer <token>`

Routes:
- `GET /feeds/:feedId/next`
- `POST /feeds/:feedId/interactions`
- `GET /feeds/:feedId/saved`

Interaction request:

```json
{
  "catalogItemId": 56,
  "type": "like"
}
```

Allowed `type` values:
- `like`
- `pass`
- `save`

---

## API Response Shapes (DTOs)

Use these as frontend TypeScript contracts.

```ts
export type UserDto = {
  id: number;
  name: string;
  email: string | null;
  createdAt: string | null;
};

export type FeedDto = {
  id: number;
  userId: number;
  name: string;
  ageMin: number | null;
  ageMax: number | null;
  relationship: string | null;
  interests: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  occasion: string | null;
  tagWeights: Record<string, number>;
  createdAt: string | null;
};

export type QueueItemDto = {
  id: number;
  sourceId: string;
  source: string;
  title: string;
  imageUrl: string | null;
  priceCents: number | null;
  currency: string | null;
  buyUrl: string | null;
  tags: string[];
};
```

`GET /feeds/:feedId/next` response:

```json
{
  "item": {
    "id": 56,
    "sourceId": "B01L2HYPNW",
    "source": "amazon",
    "title": "Product title",
    "imageUrl": "https://...",
    "priceCents": 2999,
    "currency": "USD",
    "buyUrl": "https://www.amazon.com/dp/...",
    "tags": ["outdoor", "technology"]
  },
  "queueRemaining": 7
}
```

---

## Unified Error Format

All error responses follow:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable message"
  }
}
```

Common codes to handle:
- `BAD_REQUEST` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `INTERNAL_ERROR` (500)

Frontend behavior:
- On `401`: clear token, redirect to re-login.
- On `403`: show access denied / stale feed ownership message.
- On `404`: show empty/not-found state.
- On `5xx`: retry with backoff and show generic failure UI.

---

## Recommended Frontend Service Layer

Create a thin API client module in frontend, for example:
- `src/services/giftgenius-api.ts`

Responsibilities:
- attach bearer token automatically
- parse JSON and throw typed `ApiError`
- normalize network/server errors
- retry idempotent GET requests (`/health`, `/feeds/:id/next`, `/feeds/:id/saved`) with short backoff
- do not retry mutation requests by default (`POST /feeds`, `POST /interactions`)

---

## Minimum Integration Sequence

1. Call `GET /health`.
2. Create or select user (`POST /users` or `GET /users`).
3. Login with `POST /auth/login`, store token.
4. Create/select feed (`POST /feeds`, `GET /feeds?userId=...`).
5. Fetch first card (`GET /feeds/:feedId/next` with bearer token).
6. On swipe, send `POST /feeds/:feedId/interactions`.
7. Continue loop with next card.
8. Saved tab uses `GET /feeds/:feedId/saved`.

---

## Notes for the Frontend Agent

- Do not rely on `x-user-id` for production flows.
- Treat token expiry as expected; handle `401` gracefully.
- Keep payloads small and avoid over-fetching.
- Use `buyUrl` as-is for outbound product links.
- Use backend OpenAPI docs for live contract verification:
  - `/docs` (Swagger UI)
  - `/docs/json` (OpenAPI JSON)
