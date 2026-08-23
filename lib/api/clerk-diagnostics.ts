const PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";

/** Clerk Frontend API host derived from the publishable key (matches backend). */
export function expectedClerkIssuer(): string | null {
  const encoded = PUBLISHABLE_KEY.replace(/^pk_(test|live)_/, "");
  if (!encoded) return null;
  try {
    const host = atob(encoded).replace(/\$$/, "");
    return host ? `https://${host}` : null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Dev-only hints when POST /auth/sync returns 401. */
export async function logClerkAuthDiagnostics(
  getToken: () => Promise<string | null>
): Promise<void> {
  if (!__DEV__) return;

  const token = await getToken();
  const expected = expectedClerkIssuer();

  if (!token) {
    console.warn("[GiftGenius API] Clerk token missing — session may not be ready");
    return;
  }

  const payload = decodeJwtPayload(token);
  const iss = typeof payload?.iss === "string" ? payload.iss : null;
  const sub = typeof payload?.sub === "string" ? payload.sub : null;
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  const nowSec = Math.floor(Date.now() / 1000);
  const isExpired = exp != null && exp < nowSec;
  const issuerMatches =
    iss != null &&
    expected != null &&
    iss.replace(/\/+$/, "") === expected.replace(/\/+$/, "");

  console.warn("[GiftGenius API] Clerk auth rejected by backend", {
    tokenParts: token.split(".").length,
    iss,
    expectedIssuer: expected,
    issuerMatches,
    clerkUserId: sub,
    tokenExpired: isExpired,
    tokenExp: exp,
    now: nowSec,
    hint:
      issuerMatches && !isExpired
        ? "Clerk token looks valid — check Render logs for the real error (often Supabase: missing clerk_user_id column, wrong SUPABASE_* keys, or DB schema not migrated)."
        : "On Render, set CLERK_PUBLISHABLE_KEY to EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY from .env.local, then redeploy.",
  });
}
