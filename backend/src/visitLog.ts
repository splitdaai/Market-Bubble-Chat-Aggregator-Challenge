import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Dead-simple, privacy-clean visit log. One JSON line per page load so the owner
 * can see *if and when* people visit — that's it. No IP addresses, no device
 * fingerprinting, no cookies, no third-party analytics. We record only the time,
 * which page was opened, and (if the browser sends it) where the visitor came
 * from. The file is git-ignored (lives under backend/data/).
 */
const LOG_PATH = process.env.VISIT_LOG_PATH ?? "data/visits.log";

export interface VisitEntry {
  path?: string;
  ref?: string;
}

/** A logged visit — a VisitEntry plus the server-stamped timestamp. */
export interface Visit extends VisitEntry {
  ts?: string;
}

/** Append a single visit as a JSON line. Best-effort — never throws to callers. */
export async function recordVisit(entry: VisitEntry): Promise<void> {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n";
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(LOG_PATH, line);
  } catch (e) {
    console.error("visit log write failed:", e);
  }
}

/** The most recent visits (newest first) for an at-a-glance "anyone been on?" view. */
export async function recentVisits(limit = 25): Promise<Visit[]> {
  try {
    const txt = await readFile(LOG_PATH, "utf8");
    return txt
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((l) => {
        try {
          return JSON.parse(l) as Visit;
        } catch {
          return null;
        }
      })
      .filter((e): e is Visit => e !== null);
  } catch {
    return [];
  }
}

/** Counts: total, today, and per-day so you can see when traffic happened. */
export async function visitSummary(): Promise<{ total: number; today: number; byDay: Record<string, number> }> {
  try {
    const txt = await readFile(LOG_PATH, "utf8");
    const entries = txt
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as { ts?: string };
        } catch {
          return null;
        }
      })
      .filter((e): e is { ts?: string } => e !== null);

    const today = new Date().toISOString().slice(0, 10);
    const byDay: Record<string, number> = {};
    for (const e of entries) {
      const day = (e.ts ?? "").slice(0, 10);
      if (day) byDay[day] = (byDay[day] ?? 0) + 1;
    }
    return { total: entries.length, today: byDay[today] ?? 0, byDay };
  } catch {
    return { total: 0, today: 0, byDay: {} };
  }
}
