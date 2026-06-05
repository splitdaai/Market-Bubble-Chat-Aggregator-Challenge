import { describe, it, expect } from "vitest";
import { compact, watchTime, elapsed } from "@/lib/format";

describe("compact", () => {
  it("leaves sub-1k counts as-is", () => {
    expect(compact(0)).toBe("0");
    expect(compact(842)).toBe("842");
  });
  it("formats thousands (1 decimal under 10k, 0 above)", () => {
    expect(compact(1234)).toBe("1.2k");
    expect(compact(15000)).toBe("15k");
  });
  it("formats millions", () => {
    expect(compact(1_200_000)).toBe("1.2M");
  });
});

describe("watchTime", () => {
  it("uses minutes under an hour", () => {
    expect(watchTime(30)).toEqual({ value: "30", unit: "min" });
  });
  it("converts to hours", () => {
    expect(watchTime(120)).toEqual({ value: "2.0", unit: "hrs" });
  });
  it("uses k-hours past 1000h", () => {
    expect(watchTime(120_000)).toEqual({ value: "2.0k", unit: "hrs" });
  });
});

describe("elapsed", () => {
  it("formats mm:ss under an hour", () => {
    expect(elapsed(83_000)).toBe("1:23");
  });
  it("formats h:mm:ss with zero-padding", () => {
    expect(elapsed(3_723_000)).toBe("1:02:03");
  });
});
