import { create } from "zustand";
import type { Platform } from "@shared/types";

/**
 * Persisted Bubble Bucks ledger.
 *
 * The live stats store only knows what's happened this session — on reload it
 * starts from zero. This store snapshots each viewer's lifetime activity and
 * merges it back into balances so Bubble Bucks survive reloads.
 *
 * PERF: this is hot — the stats tick touches every known chatter (hundreds)
 * every 1.5s. So:
 *   • `bulkUpsert` does ONE `set` for the whole batch (not one per user).
 *   • localStorage persistence is THROTTLED to ~12s (and flushed on hide /
 *     unload) instead of writing the full map on every change. Writing an
 *     800-entry JSON blob 800×/tick was the main cause of the slowdown.
 *
 * When the backend lands, this is the seam where the server's authoritative
 * per-user balance comes in.
 */

export interface LedgerEntry {
  /** Earliest "first seen" timestamp across all sessions (epoch ms). */
  first: number;
  /** Most recent "last seen" timestamp across all sessions (epoch ms). */
  last: number;
  /** Lifetime messages. */
  count: number;
  /** Lifetime dollars donated (tips + bits + sub $). */
  donated: number;
  /** Lifetime subs (own + gifted). */
  subs: number;
  /** Lifetime Bubble Bucks spent (engagement actions, perks, tipping). */
  spent: number;
}

type LedgerKey = string; // `${platform}:${username.toLowerCase()}`

const STORAGE_KEY = "vibechat-bucks-ledger";
const PERSIST_THROTTLE_MS = 12_000;

const k = (platform: Platform, username: string) => `${platform}:${username.toLowerCase()}`;

/** Merge a partial row into an existing entry (lifetime-max semantics). */
function mergeEntry(prev: LedgerEntry | undefined, e: Partial<LedgerEntry>): LedgerEntry {
  return {
    first: Math.min(prev?.first ?? Number.POSITIVE_INFINITY, e.first ?? Date.now()),
    last: Math.max(prev?.last ?? 0, e.last ?? Date.now()),
    count: Math.max(prev?.count ?? 0, e.count ?? 0),
    donated: Math.max(prev?.donated ?? 0, e.donated ?? 0),
    subs: Math.max(prev?.subs ?? 0, e.subs ?? 0),
    spent: Math.max(prev?.spent ?? 0, e.spent ?? prev?.spent ?? 0),
  };
}

/** Load + migrate the persisted map (handles the legacy zustand-persist shape). */
function loadEntries(): Record<LedgerKey, LedgerEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Accept both the new flat shape and the old zustand-persist {state:{entries}}.
    const src: Record<string, Partial<LedgerEntry>> =
      parsed?.entries ?? parsed?.state?.entries ?? parsed ?? {};
    const out: Record<LedgerKey, LedgerEntry> = {};
    for (const [key, e] of Object.entries(src)) {
      if (!e || typeof e !== "object") continue;
      out[key] = {
        first: e.first ?? Date.now(),
        last: e.last ?? Date.now(),
        count: e.count ?? 0,
        donated: e.donated ?? 0,
        subs: e.subs ?? 0,
        spent: e.spent ?? 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

interface LedgerState {
  entries: Record<LedgerKey, LedgerEntry>;
  /** Merge a single row (engagement spend, seeds). */
  upsert: (platform: Platform, username: string, e: Partial<LedgerEntry>) => void;
  /** Merge MANY rows in one update — the hot path called every stats tick. */
  bulkUpsert: (rows: { platform: Platform; username: string; e: Partial<LedgerEntry> }[]) => void;
  /** Add Bubble Bucks spend for a user (engagement actions, perks). */
  addSpent: (platform: Platform, username: string, amount: number) => void;
  /** Get the merged view for a user (ledger-or-empty). */
  get: (platform: Platform, username: string) => LedgerEntry | null;
}

export const useBucksLedger = create<LedgerState>((set, get) => ({
  entries: loadEntries(),

  upsert: (platform, username, e) => {
    const key = k(platform, username);
    const next = { ...get().entries, [key]: mergeEntry(get().entries[key], e) };
    set({ entries: next });
    schedulePersist(next);
  },

  bulkUpsert: (rows) => {
    if (!rows.length) return;
    const cur = get().entries;
    let changed = false;
    // Mutate a shallow copy once, not per-row spreads.
    const next: Record<LedgerKey, LedgerEntry> = { ...cur };
    for (const { platform, username, e } of rows) {
      const key = k(platform, username);
      const merged = mergeEntry(next[key], e);
      const prev = next[key];
      // Skip writes that don't actually change anything (avoids re-renders).
      if (
        !prev ||
        prev.first !== merged.first ||
        prev.last !== merged.last ||
        prev.count !== merged.count ||
        prev.donated !== merged.donated ||
        prev.subs !== merged.subs ||
        prev.spent !== merged.spent
      ) {
        next[key] = merged;
        changed = true;
      }
    }
    if (!changed) return;
    set({ entries: next });
    schedulePersist(next);
  },

  addSpent: (platform, username, amount) => {
    if (amount <= 0) return;
    const key = k(platform, username);
    const prev = get().entries[key] ?? { first: Date.now(), last: Date.now(), count: 0, donated: 0, subs: 0, spent: 0 };
    const next = { ...get().entries, [key]: { ...prev, last: Date.now(), spent: prev.spent + amount } };
    set({ entries: next });
    schedulePersist(next, true); // spend is meaningful — flush sooner
  },

  get: (platform, username) => get().entries[k(platform, username)] ?? null,
}));

/* ----------------------- throttled localStorage persistence ----------------------- */
let persistTimer: number | null = null;
let pendingSnapshot: Record<LedgerKey, LedgerEntry> | null = null;

function flushPersist() {
  if (persistTimer !== null) { window.clearTimeout(persistTimer); persistTimer = null; }
  if (!pendingSnapshot) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: pendingSnapshot })); } catch { /* quota */ }
  pendingSnapshot = null;
}

function schedulePersist(snapshot: Record<LedgerKey, LedgerEntry>, soon = false) {
  pendingSnapshot = snapshot;
  if (soon) { flushPersist(); return; }
  if (persistTimer !== null) return; // already scheduled
  persistTimer = window.setTimeout(flushPersist, PERSIST_THROTTLE_MS);
}

// Never lose the last few seconds of accrual on tab hide / close.
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushPersist(); });
  window.addEventListener("pagehide", flushPersist);
}
