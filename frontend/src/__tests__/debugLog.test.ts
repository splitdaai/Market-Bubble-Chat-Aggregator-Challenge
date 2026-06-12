import { describe, it, expect, beforeEach } from "vitest";
import { useDebugLog, track } from "@/lib/debugLog";

describe("debug log", () => {
  beforeEach(() => useDebugLog.getState().clear());

  it("captures a tracked event", () => {
    track("test", "hello", { foo: 1 });
    const e = useDebugLog.getState().entries.at(-1)!;
    expect(e.level).toBe("event");
    expect(e.source).toBe("test");
    expect(e.message).toBe("hello");
    expect(e.detail).toContain('"foo": 1');
  });

  it("increments unread on errors/warns and clears on markRead", () => {
    useDebugLog.getState().push({ level: "error", source: "x", message: "boom" });
    useDebugLog.getState().push({ level: "event", source: "x", message: "tracked" });
    expect(useDebugLog.getState().unread).toBe(1); // only the error counts
    useDebugLog.getState().markRead();
    expect(useDebugLog.getState().unread).toBe(0);
  });

  it("caps at the ring-buffer max", () => {
    for (let i = 0; i < 600; i++) useDebugLog.getState().push({ level: "info", source: "loop", message: `m${i}` });
    expect(useDebugLog.getState().entries.length).toBe(500);
    expect(useDebugLog.getState().entries[0].message).toBe("m100");
  });
});
