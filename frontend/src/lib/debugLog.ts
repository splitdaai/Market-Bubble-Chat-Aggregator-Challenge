/**
 * Debug & error log — a ring buffer of every error, unhandled rejection,
 * console.error, plus structured `track()` events from the app. Persists to
 * localStorage so reloads (or crashes) don't lose history. Read it from the
 * Debug Log overlay (Topbar 🐞) or programmatically via `useDebugLog`.
 *
 * Why this exists: when a user says "Connections doesn't open" or "nothing
 * happens when I click X", we want a forensic trail — not a guess.
 */

import { create } from "zustand";

export type DebugLevel = "error" | "warn" | "info" | "debug" | "event";

export interface DebugEntry {
  id: string;
  t: number;        // epoch ms
  level: DebugLevel;
  source: string;   // "window.onerror", "console", "track:obs-connect", etc.
  message: string;
  detail?: string;  // stack, JSON, etc. — full multiline
  url?: string;     // location.href when captured
}

const STORAGE_KEY = "vibechat-debug-log";
const MAX_ENTRIES = 500;
let seq = 0;
let installed = false;

interface DebugState {
  entries: DebugEntry[];
  unread: number;
  push: (e: Omit<DebugEntry, "id" | "t" | "url">) => void;
  clear: () => void;
  markRead: () => void;
}

function loadInitial(): DebugEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return (JSON.parse(raw) as DebugEntry[]).slice(-MAX_ENTRIES);
  } catch { /* ignore */ }
  return [];
}

function persist(entries: DebugEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))); } catch { /* quota */ }
}

export const useDebugLog = create<DebugState>((set, get) => ({
  entries: loadInitial(),
  unread: 0,
  push: (e) => {
    seq += 1;
    const entry: DebugEntry = {
      id: `dbg-${Date.now()}-${seq}`,
      t: Date.now(),
      url: typeof window !== "undefined" ? window.location.href : undefined,
      ...e,
    };
    const next = [...get().entries, entry].slice(-MAX_ENTRIES);
    persist(next);
    const isProblem = e.level === "error" || e.level === "warn";
    set({ entries: next, unread: get().unread + (isProblem ? 1 : 0) });
  },
  clear: () => { persist([]); set({ entries: [], unread: 0 }); },
  markRead: () => set({ unread: 0 }),
}));

/** Top-level capture of every runtime error + rejection + console.error. Idempotent. */
export function installDebugCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const log = useDebugLog.getState();

  window.addEventListener("error", (ev) => {
    log.push({
      level: "error",
      source: "window.onerror",
      message: ev.message || "(no message)",
      detail: [ev.filename && `${ev.filename}:${ev.lineno}:${ev.colno}`, ev.error?.stack].filter(Boolean).join("\n"),
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    log.push({
      level: "error",
      source: "unhandledrejection",
      message: (reason instanceof Error ? reason.message : String(reason)) || "(rejection)",
      detail: reason instanceof Error ? reason.stack : safeStringify(reason),
    });
  });

  // Wrap console.error + console.warn so library-level complaints land in the log too.
  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        log.push({
          level,
          source: `console.${level}`,
          message: args.map((a) => (typeof a === "string" ? a : safeStringify(a))).join(" ").slice(0, 600),
        });
      } catch { /* never let logging crash the app */ }
      original(...args);
    };
  }
}

/** Structured event tracking — call sites tag their tag:source/event for traceability. */
export function track(source: string, message: string, detail?: unknown): void {
  useDebugLog.getState().push({
    level: "event",
    source,
    message,
    detail: detail == null ? undefined : typeof detail === "string" ? detail : safeStringify(detail),
  });
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}
