/**
 * Client-side load timing.
 *
 * The backend traces its own work, but the number the user actually feels starts
 * at sign-in and ends when a card is on screen — and a lot of that sits outside
 * the server: sequential bootstrap calls, the 4s poll interval, and the fixed
 * loading overlay. This records a timeline of those steps so the console shows
 * where the wait went, and prints the server's reported time next to each
 * request so network overhead is the visible difference.
 *
 * Disable with EXPO_PUBLIC_FEED_DIAG=false.
 */

export const FEED_DIAG =
  (process.env.EXPO_PUBLIC_FEED_DIAG ?? "true").toLowerCase() !== "false";

type Mark = {
  label: string;
  atMs: number;
  sincePreviousMs: number;
  detail?: Record<string, unknown>;
};

type Timeline = {
  name: string;
  startedAt: number;
  marks: Mark[];
  done: boolean;
};

let active: Timeline | null = null;

const ms = (n: number) => `${Math.round(n).toLocaleString()}ms`;

/**
 * Begin a timeline. A new one replaces any unfinished predecessor, which is the
 * right behaviour here: switching feeds mid-load abandons the previous attempt.
 */
export function startTimeline(name: string, detail?: Record<string, unknown>): void {
  if (!FEED_DIAG) return;
  active = { name, startedAt: Date.now(), marks: [], done: false };
  console.log(`[Timing] ▶ ${name}`, detail ?? "");
}

/** Record a step. Logged immediately so a hang shows the last step reached. */
export function mark(label: string, detail?: Record<string, unknown>): void {
  if (!FEED_DIAG || !active) return;
  const atMs = Date.now() - active.startedAt;
  const previous = active.marks[active.marks.length - 1];
  const sincePreviousMs = atMs - (previous?.atMs ?? 0);
  active.marks.push({ label, atMs, sincePreviousMs, detail });
  console.log(
    `[Timing]   +${ms(sincePreviousMs)} (${ms(atMs)} total) ${label}`,
    detail ?? "",
  );
}

/** Close the timeline and print the summary, slowest step first. */
export function endTimeline(outcome: string, detail?: Record<string, unknown>): void {
  if (!FEED_DIAG || !active || active.done) return;
  const timeline = active;
  timeline.done = true;
  const totalMs = Date.now() - timeline.startedAt;

  const slowest = [...timeline.marks].sort(
    (a, b) => b.sincePreviousMs - a.sincePreviousMs,
  );
  const lines = [
    "",
    "──────────────────────────────────────────────────────────",
    `CLIENT TIMING  ${timeline.name}  —  ${ms(totalMs)}  (${outcome})`,
    "──────────────────────────────────────────────────────────",
    ...slowest.map((m) => {
      const share = totalMs > 0 ? (m.sincePreviousMs / totalMs) * 100 : 0;
      return `  ${ms(m.sincePreviousMs).padStart(9)}  ${share.toFixed(1).padStart(5)}%  ${m.label}`;
    }),
    "──────────────────────────────────────────────────────────",
  ];
  console.log(lines.join("\n"), detail ?? "");
  active = null;
}

/** Time one awaited step and mark it, including on failure. */
export async function timed<T>(
  label: string,
  fn: () => Promise<T>,
  detail?: Record<string, unknown>,
): Promise<T> {
  if (!FEED_DIAG) return fn();
  try {
    const value = await fn();
    mark(label, detail);
    return value;
  } catch (error) {
    mark(`${label} (failed)`, {
      ...detail,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Log one HTTP request with the server's own reported total alongside, so the
 * difference reads as network + serialization rather than being invisible.
 */
export function logRequest(
  method: string,
  path: string,
  totalMs: number,
  info: { status?: number; serverMs?: number | null; error?: string } = {},
): void {
  if (!FEED_DIAG) return;
  const parts = [`${method} ${path}`, `${ms(totalMs)}`];
  if (info.status != null) parts.push(`→ ${info.status}`);
  if (info.serverMs != null) {
    parts.push(`server ${ms(info.serverMs)}`, `network+overhead ${ms(totalMs - info.serverMs)}`);
  }
  if (info.error) parts.push(`error: ${info.error}`);
  console.log(`[Timing]   ${parts.join("  ")}`);
}
