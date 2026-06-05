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

export function isAddress(a: string | undefined | null): a is string {
  return !!a && /^0x[a-fA-F0-9]{40}$/.test(a);
}

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
