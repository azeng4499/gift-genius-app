/**
 * Frontend API client reference implementation.
 *
 * Purpose:
 * - Typed wrappers for GiftGenius backend endpoints
 * - Centralized base URL, auth header, retries, and error mapping
 *
 * Usage in frontend app:
 *   const api = createGiftGeniusApiClient({
 *     baseUrl: process.env.EXPO_PUBLIC_GIFTGENIUS_API_BASE_URL!,
 *     getUserId: () => userContext.userId,
 *   });
 */

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

export type HealthDto = {
  ok: boolean;
  service?: string;
  timestamp?: string;
};

export type LoginResponseDto = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: UserDto;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  requiresAuth?: boolean;
  retries?: number;
};

type AccessTokenValue = string | null | undefined;

type ApiClientConfig = {
  baseUrl: string;
  // Used for feed-scoped routes requiring ownership checks.
  getUserId?: () => number | null | undefined;
  // Used when backend requires Bearer auth on secured routes. May return a
  // string synchronously (legacy demo bearer cached in user-context) or a
  // Promise (Clerk JWT fetched on demand via `getClerkToken`).
  getAccessToken?: () => AccessTokenValue | Promise<AccessTokenValue>;
  defaultRetries?: number;
};

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
      const userId = config.getUserId?.();
      const accessToken = await config.getAccessToken?.();

      if (accessToken) {
        headers.authorization = `Bearer ${accessToken}`;
      }

      if (userId && userId > 0) {
        headers["x-user-id"] = String(userId);
      }

      if (!accessToken && (!userId || userId <= 0)) {
        throw new ApiError(
          "UNAUTHORIZED",
          "Missing auth context. Set userId or access token before secured feed routes."
        );
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
          const code = payload?.error?.code as ApiErrorCode | undefined;
          const message = payload?.error?.message || `Request failed with status ${res.status}`;
          if (res.status === 429) {
            throw new ApiError("RATE_LIMITED", message, res.status);
          }
          throw new ApiError(code || "INTERNAL_ERROR", message, res.status);
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
    // Health
    async getHealth(): Promise<HealthDto> {
      return request<HealthDto>("/health", { retries: 0 });
    },

    // Users
    async getUsers(): Promise<UserDto[]> {
      const res = await request<{ users: UserDto[] }>("/users");
      return res.users;
    },
    async createUser(payload: { name: string; email?: string }): Promise<UserDto> {
      return request<UserDto>("/users", {
        method: "POST",
        body: payload,
      });
    },
    async loginWithEmail(email: string): Promise<LoginResponseDto> {
      return request<LoginResponseDto>("/auth/login", {
        method: "POST",
        body: { email },
      });
    },

    // Feeds
    async getFeeds(userId: number): Promise<FeedDto[]> {
      const res = await request<{ feeds: FeedDto[] }>(
        `/feeds?userId=${encodeURIComponent(String(userId))}`
      );
      return res.feeds;
    },
    async createFeed(payload: {
      userId: number;
      name: string;
      relationship?: string;
      interests?: string[];
      budgetMin?: number;
      budgetMax?: number;
      occasion?: string | null;
    }): Promise<FeedDto> {
      return request<FeedDto>("/feeds", {
        method: "POST",
        body: payload,
      });
    },

    /** Partial update; backend should accept the same preference fields as create. */
    async updateFeed(
      feedId: number,
      payload: {
        name: string;
        relationship?: string | null;
        interests?: string[];
        budgetMin?: number | null;
        budgetMax?: number | null;
        occasion?: string | null;
      }
    ): Promise<FeedDto> {
      return request<FeedDto>(`/feeds/${feedId}`, {
        method: "PATCH",
        body: payload,
        requiresAuth: true,
      });
    },

    // Feed loop
    async getNext(feedId: number): Promise<{ item: QueueItemDto; queueRemaining: number }> {
      return request<{ item: QueueItemDto; queueRemaining: number }>(`/feeds/${feedId}/next`, {
        requiresAuth: true,
      });
    },
    async postInteraction(
      feedId: number,
      payload: { catalogItemId: number; type: "like" | "pass" | "save" }
    ): Promise<{ ok: true }> {
      return request<{ ok: true }>(`/feeds/${feedId}/interactions`, {
        method: "POST",
        body: payload,
        requiresAuth: true,
      });
    },

    /**
     * Clears a previous interaction on this catalog item for the feed user.
     * Uses query params so the request has no DELETE body (wide HTTP proxy support).
     * Backend convention: DELETE /feeds/:feedId/interactions?catalogItemId=&type=like|pass|save
     */
    async deleteInteraction(
      feedId: number,
      catalogItemId: number,
      type: "like" | "pass" | "save",
    ): Promise<{ ok: true }> {
      const q = `?catalogItemId=${encodeURIComponent(String(catalogItemId))}&type=${encodeURIComponent(type)}`;
      return request<{ ok: true }>(`/feeds/${feedId}/interactions${q}`, {
        method: "DELETE",
        requiresAuth: true,
      });
    },
    async getSaved(feedId: number): Promise<QueueItemDto[]> {
      const res = await request<{ items: QueueItemDto[] }>(`/feeds/${feedId}/saved`, {
        requiresAuth: true,
      });
      return res.items;
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
