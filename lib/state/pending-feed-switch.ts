/** One-shot handoff when People asks Home to load a different recipient. */
export type PendingFeedSwitch = {
  feedId: string;
  source: "people";
};

let pending: PendingFeedSwitch | null = null;

export function queueFeedSwitch(feedId: string): void {
  pending = { feedId, source: "people" };
}

export function peekQueuedFeedSwitch(): PendingFeedSwitch | null {
  return pending;
}

export function takeQueuedFeedSwitch(): PendingFeedSwitch | null {
  const value = pending;
  pending = null;
  return value;
}
