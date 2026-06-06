import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Lightweight visitor log. One JSON line per visit, appended to a file that is
 * git-ignored (lives under backend/data/). No third-party analytics, no cookies —
 * just a timestamped record so the site owner can see traffic via SSH or the
 * aggregate /api/visits/summary endpoint.
 */
const LOG_PATH = process.env.VISIT_LOG_PATH ?? "data/visits.log";

export interface VisitEntry {
  ip?: string;
  ua?: string;
  path?: string;
  ref?: string;
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

/** Aggregate counts only — no raw IPs/UAs leave the server via this endpoint. */
export async function visitSummary(): Promise<{
  total: number;
  today: number;
  uniqueIps: number;
  byDay: Record<string, number>;
}> {
  try {
    const txt = await readFile(LOG_PATH, "utf8");
    const entries = txt
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as { ts?: string; ip?: string };
        } catch {
          return null;
        }
      })
      .filter((e): e is { ts?: string; ip?: string } => e !== null);

    const today = new Date().toISOString().slice(0, 10);
    const byDay: Record<string, number> = {};
    const ips = new Set<string>();
    for (const e of entries) {
      const day = (e.ts ?? "").slice(0, 10);
      if (day) byDay[day] = (byDay[day] ?? 0) + 1;
      if (e.ip) ips.add(e.ip);
    }
    return { total: entries.length, today: byDay[today] ?? 0, uniqueIps: ips.size, byDay };
  } catch {
    return { total: 0, today: 0, uniqueIps: 0, byDay: {} };
  }
}
