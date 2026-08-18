import { describe, expect, it } from "vitest";
import { channelsParam, parseChannelsParam } from "@/lib/urlOverrides";
import { parseXBroadcastId } from "@/store/liveSourcesStore";
import type { Account } from "@shared/types";

const accounts: Account[] = [
  { id: "twitch:eddie", platform: "twitch", handle: "eddie", displayName: "Eddie", connected: true },
  { id: "kick:eddie", platform: "kick", handle: "eddie", displayName: "Eddie", connected: true },
  { id: "youtube:eddie", platform: "youtube", handle: "@eddie", displayName: "Eddie", connected: true },
  { id: "twitch:paused", platform: "twitch", handle: "paused", displayName: "Paused", connected: false },
];

describe("OBS channel URL param", () => {
  it("round-trips connected accounts, kick rooms and the X broadcast", () => {
    const raw = channelsParam(accounts, "1kKzDDrlpOXJv", { eddie: "12345" });
    expect(raw).toBe("twitch:eddie,kick:eddie,kickroom:eddie=12345,youtube:@eddie,xbid:1kKzDDrlpOXJv");
    const parsed = parseChannelsParam(raw);
    expect(parsed.accounts.map((a) => a.id)).toEqual(["twitch:eddie", "kick:eddie", "youtube:eddie"]);
    expect(parsed.accounts.every((a) => a.connected)).toBe(true);
    expect(parsed.kickRooms).toEqual({ eddie: "12345" });
    expect(parsed.xBroadcastId).toBe("1kKzDDrlpOXJv");
  });

  it("ignores junk safely", () => {
    const parsed = parseChannelsParam("bogus:x,twitch:,kickroom:a=notanumber,xbid:!!,twitch:<script>");
    expect(parsed.accounts.map((a) => a.handle)).toEqual(["script"]);
    expect(parsed.kickRooms).toEqual({});
    expect(parsed.xBroadcastId).toBeUndefined();
  });
});

describe("X broadcast id parsing", () => {
  it("accepts links and bare ids", () => {
    expect(parseXBroadcastId("https://x.com/i/broadcasts/1kKzDDrlpOXJv")).toBe("1kKzDDrlpOXJv");
    expect(parseXBroadcastId("https://twitter.com/i/broadcasts/1abcDEF23456?s=20")).toBe("1abcDEF23456");
    expect(parseXBroadcastId("  1kKzDDrlpOXJv ")).toBe("1kKzDDrlpOXJv");
    expect(parseXBroadcastId("https://x.com/somebody/status/123")).toBeNull();
  });
});
