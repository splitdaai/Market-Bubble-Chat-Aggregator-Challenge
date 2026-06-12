import { describe, expect, it } from "vitest";
import { actionById, canAfford, canPublishOverlayEvent, engageUrl, qrImageUrl, resetOverlayPublishGate, spendBucks } from "@/lib/overlayEngagement";

describe("overlay engagement", () => {
  it("gates actions by Bubble Bucks balance", () => {
    const action = actionById("chart-pump")!;
    expect(canAfford(299, action)).toBe(false);
    expect(canAfford(300, action)).toBe(true);
  });

  it("does not expose the removed boss action", () => {
    expect(actionById("boss-attack")).toBeUndefined();
  });

  it("does not expose standalone bull or bear vote buttons", () => {
    expect(actionById("bull-vote")).toBeUndefined();
    expect(actionById("bear-vote")).toBeUndefined();
  });

  it("exposes the meme overlay actions", () => {
    expect(actionById("wagmi-meme")?.label).toBe("WAGMI");
    expect(actionById("diamond-hands-meme")?.kind).toBe("emote");
    expect(actionById("moon-meme")?.cost).toBe(15);
    expect(actionById("dogecoin-meme")?.label).toBe("Dogecoin");
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

  it("rate-limits repeated overlay actions before they reach the renderer", () => {
    resetOverlayPublishGate();
    const event = { room: "main", actionId: "ticker-boost", kind: "ticker" as const };

    expect(canPublishOverlayEvent(event, 1_000)).toBe(true);
    expect(canPublishOverlayEvent(event, 1_050)).toBe(false);
    expect(canPublishOverlayEvent(event, 1_160)).toBe(true);
  });

  it("caps room-level overlay bursts", () => {
    resetOverlayPublishGate();
    const event = { room: "main", actionId: "ticker-boost", kind: "ticker" as const };

    for (let i = 0; i < 12; i++) {
      expect(canPublishOverlayEvent(event, 1_000 + i * 150)).toBe(true);
    }
    expect(canPublishOverlayEvent(event, 2_900)).toBe(false);
    expect(canPublishOverlayEvent(event, 12_000)).toBe(true);
  });
});
