import { describe, it, expect } from "vitest";
import { toUnits, isAddress, shortAddr, stablesOn, tokenFor } from "@/lib/web3";

describe("toUnits", () => {
  it("converts whole amounts to base units", () => {
    expect(toUnits("10", 6)).toBe(10_000_000n); // 10 USDC (6 decimals)
  });
  it("handles fractional amounts", () => {
    expect(toUnits("1.5", 6)).toBe(1_500_000n);
    expect(toUnits("0.005", 18)).toBe(5_000_000_000_000_000n);
  });
  it("truncates excess precision instead of throwing", () => {
    expect(toUnits("1.2345678", 6)).toBe(1_234_567n);
  });
});

describe("isAddress", () => {
  it("accepts a valid 20-byte hex address", () => {
    expect(isAddress("0x" + "a".repeat(40))).toBe(true);
  });
  it("rejects malformed / short / non-hex input", () => {
    expect(isAddress("0x123")).toBe(false);
    expect(isAddress("not-an-address")).toBe(false);
    expect(isAddress(null)).toBe(false);
    expect(isAddress(undefined)).toBe(false);
  });
});

describe("shortAddr", () => {
  it("truncates the middle of an address", () => {
    expect(shortAddr("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
});

describe("stablecoin registry", () => {
  it("knows USDC + USDT on Ethereum mainnet", () => {
    expect(stablesOn(1).sort()).toEqual(["USDC", "USDT"]);
    expect(tokenFor(1, "USDC")?.decimals).toBe(6);
  });
  it("returns nothing for an unsupported chain", () => {
    expect(stablesOn(6281971)).toEqual([]);
    expect(tokenFor(6281971, "USDC")).toBeUndefined();
  });
});
