/**
 * GiftGenius API client — aligned to giftgenius-engine v2 routes.
 *
 * Auth: POST /auth/token → backend JWT in Authorization: Bearer header.
 * Feed loop: POST /sessions → GET /feed/:session_id → POST /feed/signal.
 */

import { clearStoredJwt } from "@/lib/state/auth-store";
import { setAccessToken } from "@/lib/state/user-context";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "RATE_LIMITED"
  | "NETWORK_ERROR";

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;

  constructor(code: ApiErrorCode, message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export type UserDto = {
  id: string;
  name: string;
  email: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** UI-facing feed shape (mapped from backend profiles). */
export type FeedDto = {
  id: string;
  userId: string;
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

export type ProfileDto = {
  id: string;
  user_id: string;
  label: string;
  hobby_ids: string[];
  budget_min: number;
  budget_max: number;
  created_at: string;
  updated_at: string;
};

export type HobbyDto = {
  id: string;
  name: string;
  slug: string;
};

export type ProfileDetailDto = ProfileDto & {
  hobbies: HobbyDto[];
  weights: {
    hobby_id: string;
    angle: string;
    weight: number;
    cooldown_until: string | null;
  }[];
};

export type SessionDto = {
  id: string;
  profile_id: string;
  occasion: string;
  started_at: string;
  ended_at: string | null;
};

export type FeedItemDto = {
  feed_event_id: string;
  asin: string;
  title: string;
  price: number;
  image_url: string;
  product_url: string;
  category: string;
  slot_type: "interest" | "adjacent" | "wildcard" | "occasion";
  hobby_id: string | null;
  angle: string | null;
  score: number;
};

/** Card model used by ProductCard and bookmarks list. */
export type QueueItemDto = {
  id: string;
  sourceId: string;
  source: string;
  title: string;
  imageUrl: string | null;
  priceCents: number | null;
  currency: string | null;
  buyUrl: string | null;
  tags: string[];
};

export type HealthDto = {
  status: string;
  timestamp?: string;
};

export type TokenResponseDto = {
  token: string;
  user: UserDto;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  requiresAuth?: boolean;
  /** Dev-only admin routes (no secret when ADMIN_SECRET unset on server). */
  admin?: boolean;
  retries?: number;
};

type AccessTokenValue = string | null | undefined;

type ApiClientConfig = {
  baseUrl: string;
  getAccessToken?: () => AccessTokenValue | Promise<AccessTokenValue>;
  defaultRetries?: number;
  onUnauthorized?: () => void;
};

function statusToCode(status: number): ApiErrorCode {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "INTERNAL_ERROR";
}

export function createGiftGeniusApiClient(config: ApiClientConfig) {
  const normalizedBase = config.baseUrl.replace(/\/+$/, "");
  const defaultRetries = config.defaultRetries ?? 1;

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const method = opts.method ?? "GET";
    const retries = opts.retries ?? defaultRetries;
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (opts.requiresAuth) {
      const accessToken = await config.getAccessToken?.();
      if (!accessToken) {
        throw new ApiError(
          "UNAUTHORIZED",
          "Missing backend access token. Run bootstrap first."
        );
      }
      headers.authorization = `Bearer ${accessToken}`;
    }

    if (opts.admin) {
      const adminSecret = process.env.EXPO_PUBLIC_GIFTGENIUS_ADMIN_SECRET?.trim();
      if (adminSecret) {
        headers["x-admin-secret"] = adminSecret;
      }
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${normalizedBase}${path}`, {
          method,
          headers,
          body: opts.body != null ? JSON.stringify(opts.body) : undefined,
        });

        const text = await res.text();
        const payload = text ? safeJsonParse(text) : null;

        if (!res.ok) {
          const message =
            payload?.message ||
            payload?.error?.message ||
            (typeof payload?.error === "string" ? payload.error : null) ||
            `Request failed with status ${res.status}`;
          const code =
            (payload?.error?.code as ApiErrorCode | undefined) ||
            statusToCode(res.status);
          if (code === "UNAUTHORIZED" && opts.requiresAuth) {
            setAccessToken(null);
            void clearStoredJwt();
            config.onUnauthorized?.();
          }
          throw new ApiError(code, message, res.status);
        }

        return payload as T;
      } catch (err) {
        lastErr = err;
        const shouldRetry =
          attempt < retries &&
          (err instanceof TypeError ||
            (err instanceof ApiError &&
              (err.code === "RATE_LIMITED" || err.status >= 500)));
        if (!shouldRetry) break;
        await sleep(250 * (attempt + 1));
      }
    }

    if (lastErr instanceof ApiError) throw lastErr;
    throw new ApiError("NETWORK_ERROR", "Network request failed");
  }

  return {
    async getHealth(): Promise<HealthDto> {
      return request<HealthDto>("/health", { retries: 0 });
    },

    /** Exchange a backend user UUID for a JWT (replaces POST /auth/login). */
    async exchangeToken(userId: string): Promise<TokenResponseDto> {
      return request<TokenResponseDto>("/auth/token", {
        method: "POST",
        body: { user_id: userId },
      });
    },

    /** Dev bootstrap: create a row in users (local admin only — not for production). */
    async createAdminUser(payload: {
      name: string;
      email: string;
    }): Promise<UserDto> {
      return request<UserDto>("/admin/users", {
        method: "POST",
        body: payload,
        admin: true,
      });
    },

    /** Authenticated hobby catalog (production-safe). */
    async listHobbiesAuth(limit = 200): Promise<HobbyDto[]> {
      const res = await request<{ data: HobbyDto[] }>(
        `/hobbies?limit=${encodeURIComponent(String(limit))}`,
        { requiresAuth: true }
      );
      return res.data ?? [];
    },

    /** Dev-only admin hobby list (local backend without ADMIN_SECRET). */
    async listHobbiesAdmin(limit = 100): Promise<HobbyDto[]> {
      const res = await request<{ data: HobbyDto[] }>(
        `/admin/hobbies?limit=${encodeURIComponent(String(limit))}`,
        { admin: true }
      );
      return res.data ?? [];
    },

    /** @deprecated Use listHobbiesAuth or listHobbiesAdmin. */
    async listHobbies(limit = 100): Promise<HobbyDto[]> {
      return this.listHobbiesAdmin(limit);
    },

    /** List profiles for the authenticated backend user. */
    async listProfiles(): Promise<ProfileDto[]> {
      const res = await request<{ data: ProfileDto[] }>("/profiles", {
        requiresAuth: true,
      });
      return res.data ?? [];
    },

    async createProfile(payload: {
      label: string;
      hobby_ids: string[];
      budget_min: number;
      budget_max: number;
    }): Promise<ProfileDto> {
      return request<ProfileDto>("/profiles", {
        method: "POST",
        body: payload,
        requiresAuth: true,
      });
    },

    async getProfile(profileId: string): Promise<ProfileDetailDto> {
      return request<ProfileDetailDto>(`/profiles/${encodeURIComponent(profileId)}`, {
        requiresAuth: true,
      });
    },

    async updateProfile(
      profileId: string,
      payload: {
        label?: string;
        hobby_ids?: string[];
        budget_min?: number;
        budget_max?: number;
      }
    ): Promise<ProfileDto> {
      return request<ProfileDto>(`/profiles/${encodeURIComponent(profileId)}`, {
        method: "PATCH",
        body: payload,
        requiresAuth: true,
      });
    },

    async createSession(
      profileId: string,
      occasion: string
    ): Promise<SessionDto> {
      return request<SessionDto>("/sessions", {
        method: "POST",
        body: { profile_id: profileId, occasion },
        requiresAuth: true,
      });
    },

    /** Replaces GET /feeds/:id/next — returns a batch of feed cards. */
    async getFeedBatch(
      sessionId: string,
      batch = 10
    ): Promise<{ items: FeedItemDto[]; count: number }> {
      return request<{ items: FeedItemDto[]; count: number }>(
        `/feed/${encodeURIComponent(sessionId)}?batch=${encodeURIComponent(String(batch))}`,
        { requiresAuth: true }
      );
    },

    /** Replaces POST /feeds/:id/interactions. */
    async postSignal(
      feedEventId: string,
      signal: "skip" | "save" | "shop_now" | "dislike"
    ): Promise<{ ok: true }> {
      return request<{ ok: true }>("/feed/signal", {
        method: "POST",
        body: { feed_event_id: feedEventId, signal },
        requiresAuth: true,
      });
    },
  };
}

function safeJsonParse(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
