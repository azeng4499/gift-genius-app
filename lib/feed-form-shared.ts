/** Shared helpers for feed create/edit forms. */

export function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const RELATIONSHIP_OPTIONS = [
  "mom",
  "dad",
  "partner",
  "spouse",
  "friend",
  "sibling",
  "grandparent",
  "coworker",
  "child",
  "other",
] as const;

export const OCCASION_OPTIONS = [
  "birthday",
  "holiday",
  "christmas",
  "graduation",
  "wedding",
  "anniversary",
  "baby_shower",
  "thank_you",
  "just_because",
  "other",
] as const;

/** Keeps every string in `base` (preserves order); appends new tokens from comma-separated `addedRaw`, case-insensitive dedupe vs base and prior adds. */
export function mergeInterestLists(
  base: readonly string[],
  addedCommaSeparated: string,
): string[] {
  const added = addedCommaSeparated
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set(base.map((s) => s.toLowerCase()));
  const out = [...base];
  for (const item of added) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
