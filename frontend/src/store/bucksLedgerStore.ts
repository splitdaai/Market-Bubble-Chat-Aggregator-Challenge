import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Platform } from "@shared/types";

/**
 * Persisted Bubble Bucks ledger.
 *
 * The live stats store only knows what's happened this session — on reload it
 * starts from zero. This store snapshots each viewer's lifetime activity to
 * localStorage and merges it back into balances so Bubble Bucks survive
 * reloads.
 *
 * When the backend lands, this is the seam where the server's authoritative
 * per-user balance comes in (replace `mergeFromSession` with a server fetch
 * + emit a `bucks:credit` event for newly-earned BB).
 *
 * Watch time is accrued by extending each viewer's `first` timestamp backward
 * to the earliest first-seen we've ever recorded for them — so a returning
 * viewer's watch-time bucks keep accumulating across sessions.
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

interface LedgerState {
  entries: Record<LedgerKey, LedgerEntry>;
  /** Merge a current-session row into the ledger (called every snapshot tick). */
  upsert: (platform: Platform, username: string, e: Partial<LedgerEntry>) => void;
  /** Add Bubble Bucks spend for a user (engagement actions, perks). */
  addSpent: (platform: Platform, username: string, amount: number) => void;
  /** Get the merged view for a user (ledger-or-empty). */
  get: (platform: Platform, username: string) => LedgerEntry | null;
}

const k = (platform: Platform, username: string) => `${platform}:${username.toLowerCase()}`;

export const useBucksLedger = create<LedgerState>()(
  persist(
    (set, get) => ({
      entries: {},
      upsert: (platform, username, e) => {
        const key = k(platform, username);
        const prev = get().entries[key];
        const merged: LedgerEntry = {
          first: Math.min(prev?.first ?? Number.POSITIVE_INFINITY, e.first ?? Date.now()),
          last: Math.max(prev?.last ?? 0, e.last ?? Date.now()),
          count: Math.max(prev?.count ?? 0, e.count ?? 0),
          donated: Math.max(prev?.donated ?? 0, e.donated ?? 0),
          subs: Math.max(prev?.subs ?? 0, e.subs ?? 0),
          spent: Math.max(prev?.spent ?? 0, e.spent ?? prev?.spent ?? 0),
        };
        set({ entries: { ...get().entries, [key]: merged } });
      },
      addSpent: (platform, username, amount) => {
        if (amount <= 0) return;
        const key = k(platform, username);
        const prev = get().entries[key] ?? { first: Date.now(), last: Date.now(), count: 0, donated: 0, subs: 0, spent: 0 };
        const next: LedgerEntry = { ...prev, last: Date.now(), spent: prev.spent + amount };
        set({ entries: { ...get().entries, [key]: next } });
      },
      get: (platform, username) => get().entries[k(platform, username)] ?? null,
    }),
    {
      name: "vibechat-bucks-ledger",
      version: 2,
      // Migrate v1 entries (no `spent` field) by defaulting to 0.
      migrate: (persisted: unknown) => {
        if (!persisted || typeof persisted !== "object") return persisted as { entries: Record<LedgerKey, LedgerEntry> };
        const state = (persisted as { entries?: Record<string, Partial<LedgerEntry>> }).entries ?? {};
        const entries: Record<LedgerKey, LedgerEntry> = {};
        for (const [key, e] of Object.entries(state)) {
          entries[key] = {
            first: e.first ?? Date.now(),
            last: e.last ?? Date.now(),
            count: e.count ?? 0,
            donated: e.donated ?? 0,
            subs: e.subs ?? 0,
            spent: e.spent ?? 0,
          };
        }
        return { entries };
      },
    },
  ),
);
