/** Shared helpers for feed create/edit forms. */

export function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Turn a snake_case option value ("baby_shower") into a display label ("Baby Shower"). */
export function formatOccasionLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  mom: "Mom",
  dad: "Dad",
  partner: "Partner",
  boyfriend: "Boyfriend",
  girlfriend: "Girlfriend",
  spouse: "Spouse",
  friend: "Friend",
  best_friend: "Best friend",
  sibling: "Sibling",
  grandparent: "Grandparent",
  coworker: "Coworker",
  boss: "Boss",
  child: "Child",
  niece_nephew: "Niece / nephew",
  acquaintance: "Acquaintance",
  other: "Other",
};

export function formatRelationshipLabel(value: string): string {
  return RELATIONSHIP_LABELS[value] ?? formatOccasionLabel(value);
}

export const RELATIONSHIP_OPTIONS = [
  "mom",
  "dad",
  "partner",
  "boyfriend",
  "girlfriend",
  "spouse",
  "friend",
  "best_friend",
  "sibling",
  "grandparent",
  "coworker",
  "boss",
  "child",
  "niece_nephew",
  "acquaintance",
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
