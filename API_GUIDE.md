# GiftGenius API — Frontend Connection Guide

Backend: **Fastify** service (`GiftGeniusService`). This is the complete contract the app talks to.

- **Base URL:** `EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL` (e.g. `http://localhost:3000` in dev)
- **Content type:** `application/json` for all request/response bodies
- **CORS:** open (`origin: true`)

---

## Authentication

Every route except `/`, `/health`, `/assets/*`, and `/admin/*` requires a **Clerk session JWT**:

```
Authorization: Bearer <clerk_session_token>
```

The backend verifies the token, maps the Clerk `sub` to a backend user, and injects that user into every request. **You never send a user id** — it's derived from the token. On first call for a new Clerk user, a backend user row is created automatically.

**Dev bypass** (only when the server runs with `ALLOW_DEV_AUTH=true`): skip Clerk and send
`X-Dev-User-Id: <backend_user_uuid>` instead of the Bearer token. Off in production.

**Admin routes** (`/admin/*`) use a separate header, not Clerk:
`X-Admin-Secret: <ADMIN_SECRET>`. If the server has no `ADMIN_SECRET` set, admin routes are open (dev only). These are back-office/ops endpoints — the recipient-facing app does **not** need them.

### Error shape (all routes)

Every error returns this consistent envelope with the matching HTTP status:

```json
{ "error": { "code": "NOT_FOUND", "message": "We couldn’t find that profile." } }
```

Codes: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500), plus `VALIDATION_ERROR` (400)
and `FEED_UNAVAILABLE` (503). Validation failures return 400 with a human-readable `message`.

`401` → prompt re-sign-in. `403` → the resource belongs to another user. Messages are already
user-friendly and safe to surface directly.

---

## Enums (shared vocabulary)

| Set | Values |
|---|---|
| **occasion** | `birthday`, `christmas`, `mothers_day`, `fathers_day`, `anniversary`, `graduation`, `housewarming`, `just_because` |
| **relationship** | `mom`, `dad`, `partner`, `boyfriend`, `girlfriend`, `spouse`, `friend`, `best_friend`, `sibling`, `grandparent`, `coworker`, `boss`, `child`, `niece_nephew`, `acquaintance`, `other` (nullable) |
| **signal** | `skip`, `save`, `shop_now`, `dislike` |
| **slot_type** | `interest`, `adjacent`, `wildcard`, `occasion` |
| **angle** | `consumable`, `skill`, `experience`, `aesthetic`, `social`, `wildcard` |

---

## Auth

### `POST /auth/sync`
Ensure a backend user exists and optionally enrich name/email from the client. Idempotent — call after Clerk sign-in.

**Body** (both optional):
```json
{ "name": "Ada Lovelace", "email": "ada@example.com" }
```
**200:**
```json
{ "user": { "id": "<uuid>", "name": "Ada Lovelace", "email": "ada@example.com" } }
```

### `GET /auth/me`
Returns the authenticated backend user.

**200:** `{ "user": { "id": "<uuid>", "name": "...", "email": "..." } }`

---

## Hobbies

### `GET /hobbies`
Hobby catalog for building profiles. Read-only.

**Query:** `limit` (default 100, max 200), `offset` (default 0)
**200:**
```json
{
  "data": [ { "id": "<uuid>", "name": "Cycling", "slug": "cycling" } ],
  "total": 214, "limit": 100, "offset": 0
}
```

---

## Profiles

A profile = one gift recipient (label, interests, budget, occasion, relationship).

### `POST /profiles`
**Body:**
```json
{
  "label": "Dad",                       // required, 1–100 chars
  "hobby_ids": ["<uuid>", "..."],       // required, 1–20 hobby UUIDs
  "budget_min": 20,                     // required, int ≥ 0
  "budget_max": 100,                    // required, int ≥ 1, must be > budget_min
  "occasion": "fathers_day",            // optional enum
  "relationship": "dad"                 // optional enum, nullable
}
```
**201:** the created profile row:
```json
{
  "id": "<uuid>", "user_id": "<uuid>", "label": "Dad",
  "hobby_ids": ["<uuid>"], "budget_min": 20, "budget_max": 100,
  "occasion": "fathers_day", "relationship": "dad",
  "created_at": "...", "updated_at": "..."
}
```

### `GET /profiles`
List the current user's profiles, newest first.
**200:** `{ "data": [ <profile>, ... ] }`

### `GET /profiles/:id`
One profile, enriched with resolved hobbies and current learning weights.
**200:**
```json
{
  "id": "<uuid>", "label": "Dad", "hobby_ids": ["<uuid>"],
  "budget_min": 20, "budget_max": 100, "occasion": "fathers_day",
  "relationship": "dad", "created_at": "...", "updated_at": "...",
  "hobbies": [ { "id": "<uuid>", "name": "Cycling", "slug": "cycling" } ],
  "weights": [ { "hobby_id": "<uuid>", "angle": "skill", "weight": 1.3, "cooldown_until": null } ]
}
```
**404** not found · **403** not yours.

### `PATCH /profiles/:id`
Update any subset of fields. Same validation as create; when `hobby_ids` change, learning
weights are re-synced (removed interests penalized, new ones reset).
**Body** (all optional): `label`, `hobby_ids`, `budget_min`, `budget_max`, `occasion`, `relationship`
**200:** the updated profile row.

### `DELETE /profiles/:id/interests/:hobby_id`
Remove one interest from a profile (keeps its weights suppressed with a cooldown so it stays
deprioritized if re-added).
**200:** `{ "profile": <updated profile>, "removed_hobby_id": "<uuid>" }`
**400** `LAST_INTEREST` (can't remove the last one) · **404** `HOBBY_NOT_ON_PROFILE` / not found.

---

## Sessions

A session = one browsing run over a profile's feed for a chosen occasion.

### `POST /sessions`
**Body:**
```json
{ "profile_id": "<uuid>", "occasion": "birthday" }   // occasion optional → falls back to profile's saved occasion
```
Starting a session kicks off **background** work (Claude expansions + Amazon cache warming),
so the first `GET /feed` may return `preparing: true` — poll until items arrive.
**201:**
```json
{ "id": "<uuid>", "profile_id": "<uuid>", "occasion": "birthday", "started_at": "...", "ended_at": null }
```
**404** profile not found · **403** not yours.

### `GET /sessions/:id`
**200:** the session row (same shape as above).

### `PATCH /sessions/:id/end`
Mark a session finished.
**200:** the session row with `ended_at` set.

---

## Feed  ← the core loop

### `GET /feed/:session_id`
Get the next batch of ranked, diversity-balanced feed items.

**Query:** `batch` (default 10, clamped 1–30)
**200:**
```json
{
  "items": [
    {
      "feed_event_id": "<uuid>",   // ← use THIS id when sending a signal
      "asin": "B0...",
      "title": "Product title",
      "price": 49.99,
      "image_url": "https://...",
      "product_url": "https://...",
      "category": "Sporting Goods",
      "slot_type": "interest",     // interest | adjacent | wildcard | occasion
      "hobby_id": "<uuid|null>",
      "hobby_name": "Cycling",      // null for occasion/adjacent items
      "angle": "skill",            // null for occasion/adjacent items
      "score": 1.42
    }
  ],
  "count": 10,
  "preparing": false
}
```

**Empty batch is NOT an error.** If `items` is `[]`:
- `preparing: true` → recommendations are still being computed; **keep polling** (pull-to-refresh / retry after a short delay).
- `preparing: false` → genuinely nothing more to show right now.

**503 `FEED_UNAVAILABLE`** → transient generation error; treat like `preparing` and retry shortly.
**404** session gone (tell the user to refresh/start a new one) · **403** not yours.

> Each item returned is persisted as a `feed_event`; `feed_event_id` is what identifies it for signals and saving.

### `POST /feed/signal`
Record the user's action on a feed item. This drives the learning weights (save/shop_now boost,
skip decays, dislike zeroes + suppresses that cluster and item).

**Body:**
```json
{ "feed_event_id": "<uuid>", "signal": "save" }   // signal ∈ skip | save | shop_now | dislike
```
**200:** `{ "ok": true }`
**404** item not found · **403** not yours.

---

## Saved items (bookmarks)

An item is "saved" when you send a `save` signal on it. These endpoints read/manage that set.

### `GET /profiles/:id/saved`
Saved items for a profile, newest first.
**Query:** `limit` (default 50, max 200), `offset` (default 0)
**200:**
```json
{
  "items": [
    {
      "feed_event_id": "<uuid>",
      "asin": "B0...",
      "title": "...", "price": 49.99,
      "image_url": "https://...", "product_url": "https://...",
      "slot_type": "interest",
      "hobby_id": "<uuid|null>", "hobby_name": "Cycling|null",
      "angle": "skill|null",
      "saved_at": "..."
    }
  ],
  "count": 12, "total": 12, "limit": 50, "offset": 0
}
```

### `POST /profiles/:id/saved/:feed_event_id/copy`
Copy a bookmark onto another of the user's profiles (source bookmark stays).
**Body:** `{ "target_profile_id": "<uuid>" }`
**200:** `{ "ok": true, "already_saved": false, "feed_event_id": "<uuid-on-target>" }`
(`already_saved: true` if the target already had it.)
**400** `SAME_PROFILE` · **404** not found · **403** not yours.

### `DELETE /profiles/:id/saved/:feed_event_id`
Un-save (clears the save signal on that feed event).
**200:** `{ "ok": true }`
**404** not a saved item on this profile · **403** not yours.

---

## Health

### `GET /health` (no auth)
`{ "status": "ok", "timestamp": "..." }`

---

## Typical app flow

1. Clerk sign-in → `POST /auth/sync`.
2. `GET /hobbies` to build the picker → `POST /profiles`.
3. `POST /sessions` with the profile (+ occasion).
4. Poll `GET /feed/:session_id?batch=10`; while `preparing` or `count===0`, retry.
5. For each swipe/tap → `POST /feed/signal` with `feed_event_id` + `signal`.
6. Saved tab → `GET /profiles/:id/saved`; copy/remove as needed.
7. `PATCH /sessions/:id/end` when the user leaves the feed.

## Admin (ops only — not for the recipient app)
`X-Admin-Secret` auth. Endpoints: `POST /admin/taxonomy/sync`, `GET /admin/taxonomy`,
`POST /admin/precompute`, `POST /admin/cache/refresh`, `GET /admin/api-usage`,
`GET|POST /admin/hobbies`, `GET|POST /admin/users`, `GET /admin/profiles`,
`GET /admin/sessions`, `GET /admin/stats`.
