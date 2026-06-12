import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "@/store/chatStore";
import type { ChatMessage } from "@shared/types";

function makeStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
}

function msg(id: string, platform: ChatMessage["platform"], timestamp: number): ChatMessage {
  return {
    id,
    platform,
    username: `${platform}-user`,
    message: `${platform} message`,
    timestamp,
  };
}

describe("chat store refresh cache", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: makeStorage() });
    useChatStore.setState({
      messages: [],
      history: {},
      statuses: [],
      deleted: new Set(),
      isMock: true,
      cacheMode: null,
    });
  });

  it("restores all live platforms after a browser refresh", () => {
    useChatStore.getState().resetForMode(false);
    useChatStore.getState().addMessages([
      msg("t1", "twitch", 1000),
      msg("k1", "kick", 1001),
      msg("x1", "x", 1002),
    ]);

    useChatStore.getState().resetForMode(true);
    expect(useChatStore.getState().messages).toHaveLength(0);

    useChatStore.getState().resetForMode(false);
    expect(useChatStore.getState().messages.map((m) => m.platform)).toEqual(["twitch", "kick", "x"]);
  });

  it("dedupes backend backlog replay and keeps chronological order", () => {
    useChatStore.getState().resetForMode(false);
    useChatStore.getState().addMessages([
      msg("t1", "twitch", 1000),
      msg("x1", "x", 1002),
    ]);

    useChatStore.getState().resetForMode(false);
    useChatStore.getState().addMessages([
      msg("k1", "kick", 1001),
      msg("x1", "x", 1002),
      msg("t2", "twitch", 1003),
    ]);

    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(["t1", "k1", "x1", "t2"]);
  });
});
