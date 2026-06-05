/**
 * Minimal non-custodial EVM helpers built on the injected EIP-1193 provider
 * (MetaMask / Rabby / Coinbase Wallet). No private keys ever touch the app —
 * every transfer is signed and broadcast by the user's own wallet popup.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/** A few common EVM chains for friendly labels in the tip UI. */
export const CHAINS: Record<number, { name: string; symbol: string; explorer: string }> = {
  1: { name: "Ethereum", symbol: "ETH", explorer: "https://etherscan.io" },
  8453: { name: "Base", symbol: "ETH", explorer: "https://basescan.org" },
  10: { name: "Optimism", symbol: "ETH", explorer: "https://optimistic.etherscan.io" },
  42161: { name: "Arbitrum", symbol: "ETH", explorer: "https://arbiscan.io" },
  137: { name: "Polygon", symbol: "MATIC", explorer: "https://polygonscan.com" },
  56: { name: "BNB Chain", symbol: "BNB", explorer: "https://bscscan.com" },
};

export function chainInfo(chainId: number) {
  return CHAINS[chainId] ?? { name: `Chain ${chainId}`, symbol: "ETH", explorer: "" };
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export function getProvider(): Eip1193Provider {
  if (!window.ethereum) throw new Error("No EVM wallet found. Install MetaMask, Rabby or Coinbase Wallet.");
  return window.ethereum;
}

/** Prompt the wallet to connect; returns the selected account + chain id. */
export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  const p = getProvider();
  const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.length) throw new Error("No account authorized.");
  const chainHex = (await p.request({ method: "eth_chainId" })) as string;
  return { address: accounts[0], chainId: parseInt(chainHex, 16) };
}

/** Ask the wallet to switch to Ethereum mainnet (where USDC/USDT live). */
export async function switchToEthereum(): Promise<void> {
  const p = getProvider();
  await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
}

/** Read the currently-authorized account without prompting (for silent rehydrate). */
export async function getCurrentAccount(): Promise<{ address: string; chainId: number } | null> {
  if (!hasInjectedWallet()) return null;
  const p = getProvider();
  const accounts = (await p.request({ method: "eth_accounts" })) as string[];
  if (!accounts?.length) return null;
  const chainHex = (await p.request({ method: "eth_chainId" })) as string;
  return { address: accounts[0], chainId: parseInt(chainHex, 16) };
}

/** Convert a decimal token amount (e.g. "0.01") to a wei hex string. */
export function toWeiHex(amount: string): string {
  const [whole = "0", fracRaw = ""] = amount.trim().split(".");
  const frac = (fracRaw + "0".repeat(18)).slice(0, 18);
  const wei = BigInt(whole || "0") * 10n ** 18n + BigInt(frac || "0");
  return "0x" + wei.toString(16);
}

/**
 * Send a native-token tip from the connected wallet to `to`. The wallet popup
 * asks the human to confirm — the app never auto-sends. Returns the tx hash.
 */
export async function sendTip(from: string, to: string, amount: string): Promise<string> {
  if (!isAddress(to)) throw new Error("Invalid recipient address.");
  const p = getProvider();
  const hash = (await p.request({
    method: "eth_sendTransaction",
    params: [{ from, to, value: toWeiHex(amount) }],
  })) as string;
  return hash;
}

/* ------------------------------ stablecoins -------------------------------- */

export type Stable = "USDC" | "USDT";
export interface TokenInfo { address: string; decimals: number }

/** Canonical USDC/USDT contracts per chain (all 6-decimals on these chains). */
export const STABLES: Record<number, Partial<Record<Stable, TokenInfo>>> = {
  1: { // Ethereum
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  },
  8453: { // Base
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  },
  42161: { // Arbitrum
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
  },
  10: { // Optimism
    USDC: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    USDT: { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
  },
  137: { // Polygon
    USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
  },
};

export function tokenFor(chainId: number | null, symbol: Stable): TokenInfo | undefined {
  return chainId ? STABLES[chainId]?.[symbol] : undefined;
}

/** Which stablecoins are deployed on this chain. */
export function stablesOn(chainId: number | null): Stable[] {
  return chainId && STABLES[chainId] ? (Object.keys(STABLES[chainId]) as Stable[]) : [];
}

/** Convert a decimal token amount to integer base units. */
export function toUnits(amount: string, decimals: number): bigint {
  const [whole = "0", fracRaw = ""] = amount.trim().split(".");
  const frac = (fracRaw + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
}

/**
 * Send an ERC-20 stablecoin tip (USDC/USDT). Encodes a standard
 * `transfer(address,uint256)` call and routes it through the user's wallet,
 * which prompts them to confirm — the app never auto-sends.
 */
export async function sendToken(from: string, token: TokenInfo, to: string, amount: string): Promise<string> {
  if (!isAddress(to)) throw new Error("Invalid recipient address.");
  const units = toUnits(amount, token.decimals);
  const data =
    "0xa9059cbb" +
    to.toLowerCase().replace(/^0x/, "").padStart(64, "0") +
    units.toString(16).padStart(64, "0");
  const p = getProvider();
  const hash = (await p.request({
    method: "eth_sendTransaction",
    params: [{ from, to: token.address, data, value: "0x0" }],
  })) as string;
  return hash;
}

export function isAddress(a: string | undefined | null): a is string {
  return !!a && /^0x[a-fA-F0-9]{40}$/.test(a);
}

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
