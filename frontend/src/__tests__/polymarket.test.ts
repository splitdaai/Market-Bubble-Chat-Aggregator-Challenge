import { describe, it, expect } from "vitest";
import { fmtVol, breakingFrom, type PolyMarket } from "@/lib/polymarket";

describe("fmtVol", () => {
  it("formats k / M / B volumes", () => {
    expect(fmtVol(500)).toBe("$500");
    expect(fmtVol(45_000)).toBe("$45k");
    expect(fmtVol(1_200_000)).toBe("$1.2M");
    expect(fmtVol(2_500_000_000)).toBe("$2.5B");
  });
});

const mkt = (id: string, volume24h: number, volumeTotal: number): PolyMarket => ({
  id, question: id, outcome: "Yes", prob: 0.5, volume24h, volumeTotal,
  category: "crypto", tags: [], url: "https://polymarket.com",
});

describe("breakingFrom", () => {
  it("ranks by share of total volume happening in the last 24h", () => {
    const markets = [
      mkt("steady", 1_000, 1_000_000), // 0.1% recent
      mkt("breaking", 900_000, 1_000_000), // 90% recent — heating up
      mkt("mid", 250_000, 1_000_000), // 25% recent
    ];
    const order = breakingFrom(markets).map((m) => m.id);
    expect(order[0]).toBe("breaking");
    expect(order[1]).toBe("mid");
  });
  it("ignores markets with no total volume", () => {
    const markets = [mkt("zero", 100, 0), mkt("real", 100, 1000)];
    expect(breakingFrom(markets).map((m) => m.id)).toEqual(["real"]);
  });
});
