import { describe, expect, it } from "vitest";
import { actionById, canAfford, engageUrl, qrImageUrl, spendBucks } from "@/lib/overlayEngagement";

describe("overlay engagement", () => {
  it("gates actions by Bubble Bits balance", () => {
    const action = actionById("boss-attack")!;
    expect(canAfford(124, action)).toBe(false);
    expect(canAfford(125, action)).toBe(true);
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
