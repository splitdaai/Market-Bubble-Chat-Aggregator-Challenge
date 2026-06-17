import { create } from "zustand";
import type { ChatMessage, ConnectionStatus, Platform } from "@shared/types";
import { moderate } from "@/lib/automod";
import { registerEmotes } from "@/lib/emotes";

/** Hard cap so the live feed never leaks memory during a long stream. */
const MAX_MESSAGES = 300;
const LIVE_CACHE_KEY = "vibechat-live-chat-cache-v1";
/** Per-user history cap — kept separate from the feed so a user's profile can
 *  show useful recent context without retaining an unbounded session log. */
const MAX_PER_USER = 160;
const MAX_HISTORY_USERS = 450;

/** Key a user's history by platform + name (same name on two platforms = two users). */
export const userKey = (platform: Platform, username: string) => `${platform}:${username}`;

function trimHistoryUsers(history: Record<string, ChatMessage[]>): Record<string, ChatMessage[]> {
  const keys = Object.keys(history);
  if (keys.length <= MAX_HISTORY_USERS) return history;

  const keep = new Set(
    keys
      .map((key) => {
        const messages = history[key];
        return { key, last: messages[messages.length - 1]?.timestamp ?? 0 };
      })
      .sort((a, b) => b.last - a.last)
      .slice(0, MAX_HISTORY_USERS)
      .map((x) => x.key),
  );

  return Object.fromEntries(keys.filter((key) => keep.has(key)).map((key) => [key, history[key]]));
}

interface ChatState {
  messages: ChatMessage[];
  /** All messages this session, grouped by user (platform:username). Not capped
   *  by the feed's rolling window, so profiles show the full history. */
  history: Record<string, ChatMessage[]>;
  statuses: ConnectionStatus[];
  /** Per-platform visibility toggles for the feed. */
  enabled: Record<Platform, boolean>;
  /** Ids the moderator deleted locally or through the backend. */
  deleted: Set<string>;
  isMock: boolean;
  cacheMode: "live" | null;

  addMessage: (m: ChatMessage) => void;
  addMessages: (messages: ChatMessage[]) => void;
  setStatuses: (s: ConnectionStatus[]) => void;
  togglePlatform: (p: Platform) => void;
  markDeleted: (id: string) => void;
  setMock: (v: boolean) => void;
  resetForMode: (demo: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  history: {},
  statuses: [],
  enabled: { twitch: true, kick: true, x: true, youtube: true },
  deleted: new Set(),
  isMock: true,
  cacheMode: null,

  addMessage: (rawMsg) =>
    set((s) => appendMessages(s, [rawMsg])),

  addMessages: (rawMessages) =>
    set((s) => appendMessages(s, rawMessages)),

  setStatuses: (statuses) => set({ statuses }),

  togglePlatform: (p) =>
    set((s) => ({ enabled: { ...s.enabled, [p]: !s.enabled[p] } })),

  markDeleted: (id) =>
    set((s) => {
      const deleted = new Set(s.deleted);
      deleted.add(id);
      const messages = s.messages.filter((m) => m.id !== id);
      const history = removeFromHistory(s.history, id);
      return { deleted, messages, history };
    }),

  setMock: (isMock) => set({ isMock }),
  // The live feed is connection-driven and authoritative from the backend's
  // buffer replay on (re)connect — we no longer persist a local message cache,
  // which used to replay chat from channels that are no longer connected. Always
  // start empty on a mode switch and wipe any legacy cache.
  resetForMode: () => set(() => {
    clearLiveCache();
    return { messages: [], history: {}, cacheMode: null };
  }),
  clear: () => set(() => {
    clearLiveCache();
    return { messages: [], history: {} };
  }),
}));

function appendMessages(s: ChatState, rawMessages: ChatMessage[]): Partial<ChatState> | ChatState {
  if (rawMessages.length === 0) return s;

  const accepted: ChatMessage[] = [];
  const nextHistory: Record<string, ChatMessage[]> = { ...s.history };
  const seen = new Set<string>();

  for (const m of s.messages) seen.add(m.id);
  for (const messages of Object.values(s.history)) {
    for (const m of messages) seen.add(m.id);
  }

  for (const rawMsg of rawMessages) {
    if (seen.has(rawMsg.id)) continue;
    if (s.deleted.has(rawMsg.id)) continue;
    seen.add(rawMsg.id);

    // Auto-mod: drop hard slurs entirely, censor profanity in everything else.
    const mod = moderate(rawMsg.message);
    if (mod.blocked) continue;

    const m = mod.text === rawMsg.message ? rawMsg : { ...rawMsg, message: mod.text };
    registerEmotes(m.emotes);
    accepted.push(m);

    // Append to the user's own history (capped per user).
    const key = userKey(m.platform, m.username);
    nextHistory[key] = mergeHistory(nextHistory[key] ?? [], m);
  }

  if (accepted.length === 0) return s;

  const combined = mergeFeed(s.messages, accepted);
  return { messages: combined, history: trimHistoryUsers(nextHistory) };
}

function mergeFeed(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of current) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()]
    .sort((a, b) => (a.timestamp - b.timestamp) || a.id.localeCompare(b.id))
    .slice(-MAX_MESSAGES);
}

function mergeHistory(current: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of current) byId.set(m.id, m);
  byId.set(incoming.id, incoming);
  return [...byId.values()]
    .sort((a, b) => (a.timestamp - b.timestamp) || a.id.localeCompare(b.id))
    .slice(-MAX_PER_USER);
}

function removeFromHistory(history: Record<string, ChatMessage[]>, id: string): Record<string, ChatMessage[]> {
  let changed = false;
  const next: Record<string, ChatMessage[]> = {};
  for (const [key, messages] of Object.entries(history)) {
    const filtered = messages.filter((m) => m.id !== id);
    if (filtered.length !== messages.length) changed = true;
    if (filtered.length > 0) next[key] = filtered;
  }
  return changed ? next : history;
}

function clearLiveCache() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(LIVE_CACHE_KEY); } catch { /* ignore */ }
}
