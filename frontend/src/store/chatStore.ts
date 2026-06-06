import { create } from "zustand";
import type { ChatMessage, ConnectionStatus, Platform } from "@shared/types";

/** Hard cap so the feed never leaks memory during a long stream. */
const MAX_MESSAGES = 400;

interface ChatState {
  messages: ChatMessage[];
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
  statuses: [],
  enabled: { twitch: true, kick: true, x: true, youtube: true },
  deleted: new Set(),
  isMock: true,

  addMessage: (m) =>
    set((s) => {
      const next = s.messages.length >= MAX_MESSAGES
        ? [...s.messages.slice(s.messages.length - MAX_MESSAGES + 1), m]
        : [...s.messages, m];
      return { messages: next };
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
  clear: () => set({ messages: [] }),
}));
