import { describe, it, expect } from "vitest";
import { useModerationStore, fmtDuration, TIMEOUT_PRESETS } from "@/store/moderationStore";

describe("fmtDuration", () => {
  it("renders compound durations", () => {
    expect(fmtDuration(60)).toBe("1m");
    expect(fmtDuration(3600)).toBe("1h");
    expect(fmtDuration(3661)).toBe("1h 1m");
    expect(fmtDuration(86400)).toBe("1d");
    expect(fmtDuration(45)).toBe("45s");
  });
  it("clamps non-positive to 0s", () => {
    expect(fmtDuration(0)).toBe("0s");
    expect(fmtDuration(-10)).toBe("0s");
  });
});

describe("moderation store — stacking timeouts", () => {
  it("accumulates, reduces, and clears a viewer's timeout", () => {
    const s = useModerationStore.getState();
    s.clearTimeout("twitch", "tester");

    expect(s.addTimeout("twitch", "tester", 300)).toBe(300); // +5m
    expect(s.addTimeout("twitch", "tester", 900)).toBe(1200); // +15m → 20m total
    expect(useModerationStore.getState().getTimeout("twitch", "tester")?.seconds).toBe(1200);

    expect(s.reduceTimeout("twitch", "tester", 300)).toBe(900); // -5m → 15m
    s.clearTimeout("twitch", "tester");
    expect(useModerationStore.getState().getTimeout("twitch", "tester")).toBeUndefined();
  });

  it("reducing below zero removes the timeout entirely", () => {
    const s = useModerationStore.getState();
    s.addTimeout("kick", "v2", 60);
    expect(s.reduceTimeout("kick", "v2", 600)).toBe(0);
    expect(useModerationStore.getState().getTimeout("kick", "v2")).toBeUndefined();
  });

  it("exposes the stackable presets", () => {
    expect(TIMEOUT_PRESETS.map((p) => p.seconds)).toEqual([60, 300, 900, 3600, 86400]);
  });
});
