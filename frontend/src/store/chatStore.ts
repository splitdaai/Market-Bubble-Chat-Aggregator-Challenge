import { create } from "zustand";
import type { ChatMessage, ConnectionStatus, Platform } from "@shared/types";
import { moderate } from "@/lib/automod";

/** Hard cap so the live feed never leaks memory during a long stream. */
const MAX_MESSAGES = 300;
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
  /** Ids the moderator deleted locally (hidden + struck). */
  deleted: Set<string>;
  isMock: boolean;

  addMessage: (m: ChatMessage) => void;
  addMessages: (messages: ChatMessage[]) => void;
  setStatuses: (s: ConnectionStatus[]) => void;
  togglePlatform: (p: Platform) => void;
  markDeleted: (id: string) => void;
  setMock: (v: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  history: {},
  statuses: [],
  enabled: { twitch: true, kick: true, x: true, youtube: true },
  deleted: new Set(),
  isMock: true,

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
      return { deleted };
    }),

  setMock: (isMock) => set({ isMock }),
  clear: () => set({ messages: [], history: {} }),
}));

function appendMessages(s: ChatState, rawMessages: ChatMessage[]): Partial<ChatState> | ChatState {
  if (rawMessages.length === 0) return s;

  const accepted: ChatMessage[] = [];
  const nextHistory: Record<string, ChatMessage[]> = { ...s.history };

  for (const rawMsg of rawMessages) {
    // Auto-mod: drop hard slurs entirely, censor profanity in everything else.
    const mod = moderate(rawMsg.message);
    if (mod.blocked) continue;

    const m = mod.text === rawMsg.message ? rawMsg : { ...rawMsg, message: mod.text };
    accepted.push(m);

    // Append to the user's own history (capped per user).
    const key = userKey(m.platform, m.username);
    const prev = nextHistory[key] ?? [];
    nextHistory[key] = prev.length >= MAX_PER_USER
      ? [...prev.slice(prev.length - MAX_PER_USER + 1), m]
      : [...prev, m];
  }

  if (accepted.length === 0) return s;

  const combined = s.messages.length + accepted.length > MAX_MESSAGES
    ? [...s.messages, ...accepted].slice(-MAX_MESSAGES)
    : [...s.messages, ...accepted];

  return { messages: combined, history: trimHistoryUsers(nextHistory) };
}
