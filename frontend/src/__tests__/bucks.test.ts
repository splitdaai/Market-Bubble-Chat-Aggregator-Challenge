import { describe, it, expect } from "vitest";
import { bucksFor, watchMinutes, BUCKS } from "@/lib/bucks";

const NOW = 1_750_000_000_000;
const min = (n: number) => n * 60_000;

describe("Bubble Bucks", () => {
  it("awards per message, sub and dollar", () => {
    expect(bucksFor({ count: 10, donated: 0, subs: 0 })).toBe(10 * BUCKS.perMessage);
    expect(bucksFor({ count: 0, donated: 0, subs: 2 })).toBe(2 * BUCKS.perSub);
    expect(bucksFor({ count: 0, donated: 20, subs: 0 })).toBe(20 * BUCKS.perDollar);
  });

  it("awards 1 BB per minute watched, accruing to now while active", () => {
    // joined 30 min ago, last active 2 min ago → still watching → 30 min
    const u = { count: 0, donated: 0, subs: 0, first: NOW - min(30), last: NOW - min(2) };
    expect(Math.round(watchMinutes(u, NOW))).toBe(30);
    expect(bucksFor(u, NOW)).toBe(30 * BUCKS.perMinute);
  });

  it("stops watch accrual after the active window closes", () => {
    // joined 60 min ago, went quiet 40 min ago → watched first→last = 20 min
    const u = { count: 0, donated: 0, subs: 0, first: NOW - min(60), last: NOW - min(40) };
    expect(Math.round(watchMinutes(u, NOW))).toBe(20);
  });

  it("combines all sources and rounds", () => {
    const u = { count: 3, donated: 5.5, subs: 1, first: NOW - min(10), last: NOW - min(1) };
    expect(bucksFor(u, NOW)).toBe(Math.round(10 + 3 + 5.5 * 5 + 100));
  });

  it("is zero for an unseen user (true lurker accrual is the backend's job)", () => {
    expect(bucksFor({ count: 0, donated: 0, subs: 0 })).toBe(0);
  });
});
