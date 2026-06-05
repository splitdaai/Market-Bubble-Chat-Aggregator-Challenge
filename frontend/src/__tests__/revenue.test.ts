import { describe, it, expect } from "vitest";
import { SUB_VALUE, subRevenue } from "@/lib/revenue";

describe("subRevenue", () => {
  it("multiplies sub count by the platform's payout rate", () => {
    expect(subRevenue("x", 10)).toBe(45); // 10 × 4.50
    expect(subRevenue("twitch", 4)).toBe(14); // 4 × 3.50
    expect(subRevenue("kick", 2)).toBe(9.5); // 2 × 4.75
  });
  it("is zero for platforms without subs", () => {
    expect(subRevenue("pumpfun", 100)).toBe(0);
  });
  it("is zero for zero subs", () => {
    expect(subRevenue("youtube", 0)).toBe(0);
  });
  it("Kick pays the creator the most per sub", () => {
    const rates = Object.entries(SUB_VALUE).filter(([, v]) => v > 0);
    const max = rates.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(max[0]).toBe("kick");
  });
});
