import { create } from "zustand";
import type { ChatMessage, ConnectionStatus, Platform } from "@shared/types";
import { moderate } from "@/lib/automod";

/** Hard cap so the live feed never leaks memory during a long stream. */
const MAX_MESSAGES = 400;
/** Per-user history cap — kept separate from the feed so a user's profile can
 *  show ALL their messages this session, not just the last few still in the feed. */
const MAX_PER_USER = 500;

/** Key a user's history by platform + name (same name on two platforms = two users). */
export const userKey = (platform: Platform, username: string) => `${platform}:${username}`;

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
    set((s) => {
      // Auto-mod: drop hard slurs entirely, censor profanity in everything else.
      const mod = moderate(rawMsg.message);
      if (mod.blocked) return s;
      const m = mod.text === rawMsg.message ? rawMsg : { ...rawMsg, message: mod.text };
      const next = s.messages.length >= MAX_MESSAGES
        ? [...s.messages.slice(s.messages.length - MAX_MESSAGES + 1), m]
        : [...s.messages, m];
      // Append to the user's own history (capped per user).
      const key = userKey(m.platform, m.username);
      const prev = s.history[key] ?? [];
      const userHist = prev.length >= MAX_PER_USER ? [...prev.slice(prev.length - MAX_PER_USER + 1), m] : [...prev, m];
      return { messages: next, history: { ...s.history, [key]: userHist } };
    }),

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
