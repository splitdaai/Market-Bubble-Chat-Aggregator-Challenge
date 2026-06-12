import { describe, expect, it } from "vitest";
import { actionById, canAfford, engageUrl, qrImageUrl, spendBucks } from "@/lib/overlayEngagement";

describe("overlay engagement", () => {
  it("gates actions by Bubble Bucks balance", () => {
    const action = actionById("chart-pump")!;
    expect(canAfford(299, action)).toBe(false);
    expect(canAfford(300, action)).toBe(true);
  });

  it("does not expose the removed boss action", () => {
    expect(actionById("boss-attack")).toBeUndefined();
  });

  it("spends only when balance can cover the action", () => {
    const action = actionById("ticker-boost")!;
    expect(spendBucks(9, action)).toBe(9);
    expect(spendBucks(25, action)).toBe(15);
  });

  it("builds QR-safe engage URLs", () => {
    const url = engageUrl("show room", "https://marketbubble.chat", "/live");
    expect(url).toBe("https://marketbubble.chat/live?engage=1&room=show%20room");
    expect(qrImageUrl(url)).toContain(encodeURIComponent(url));
  });
});
