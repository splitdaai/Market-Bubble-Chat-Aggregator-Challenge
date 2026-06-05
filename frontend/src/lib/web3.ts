/**
 * Minimal non-custodial EVM helpers. Wallets are discovered via EIP-6963
 * (multi-injected-provider discovery) so the operator can explicitly pick
 * MetaMask or Phantom even when several extensions are installed and fighting
 * over `window.ethereum`. No private keys ever touch the app — every transfer
 * is signed and broadcast by the user's own wallet popup.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
}

interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    phantom?: { ethereum?: Eip1193Provider };
  }
}

/** A wallet the browser exposes (MetaMask, Phantom, …). */
export interface WalletOption {
  rdns: string;
  name: string;
  icon?: string;
  provider: Eip1193Provider;
}

// EIP-6963: wallets announce themselves in response to our request event.
const announced = new Map<string, WalletOption>();
if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (e) => {
    const detail = (e as CustomEvent<Eip6963Detail>).detail;
    if (detail?.info?.rdns && detail.provider) {
      announced.set(detail.info.rdns, {
        rdns: detail.info.rdns, name: detail.info.name, icon: detail.info.icon, provider: detail.provider,
      });
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

// MetaMask + Phantom float to the top of the picker.
const PREFERRED = ["io.metamask", "app.phantom"];

/** Every EVM wallet the browser exposes, MetaMask + Phantom first. */
export function discoverWallets(): WalletOption[] {
  if (typeof window === "undefined") return [];
  window.dispatchEvent(new Event("eip6963:requestProvider")); // re-poll late injectors
  const list = new Map(announced);

  // Fallbacks for wallets that don't (yet) announce via EIP-6963.
  if (!list.has("app.phantom") && window.phantom?.ethereum) {
    list.set("app.phantom", { rdns: "app.phantom", name: "Phantom", provider: window.phantom.ethereum });
  }
  if (!list.has("io.metamask") && window.ethereum?.isMetaMask) {
    list.set("io.metamask", { rdns: "io.metamask", name: "MetaMask", provider: window.ethereum });
  }
  if (list.size === 0 && window.ethereum) {
    list.set("injected", { rdns: "injected", name: "Browser Wallet", provider: window.ethereum });
  }

  const rank = (r: string) => (PREFERRED.indexOf(r) === -1 ? 99 : PREFERRED.indexOf(r));
  return [...list.values()].sort((a, b) => rank(a.rdns) - rank(b.rdns));
}

function pickWallet(rdns?: string): WalletOption | undefined {
  const wallets = discoverWallets();
  return (rdns ? wallets.find((w) => w.rdns === rdns) : undefined) ?? wallets[0];
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
  return discoverWallets().length > 0;
}

// The provider the operator actually connected through — used for every signed
// call so a send always goes to the same wallet they picked.
let active: Eip1193Provider | null = null;

export function getProvider(): Eip1193Provider {
  const p = active ?? (typeof window !== "undefined" ? window.ethereum : undefined);
  if (!p) throw new Error("No EVM wallet connected. Install MetaMask or Phantom.");
  return p;
}

/** Prompt a specific wallet (by rdns) to connect; returns account + chain + wallet name. */
export async function connectWallet(rdns?: string): Promise<{ address: string; chainId: number; rdns: string; name: string }> {
  const chosen = pickWallet(rdns);
  if (!chosen) throw new Error("No EVM wallet found. Install MetaMask or Phantom.");
  const accounts = (await chosen.provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.length) throw new Error("No account authorized.");
  const chainHex = (await chosen.provider.request({ method: "eth_chainId" })) as string;
  active = chosen.provider;
  return { address: accounts[0], chainId: parseInt(chainHex, 16), rdns: chosen.rdns, name: chosen.name };
}

/** Ask the wallet to switch to Ethereum mainnet (where USDC/USDT live). */
export async function switchToEthereum(): Promise<void> {
  await getProvider().request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
}

/** The live provider for event listeners — by rdns if the caller knows which wallet. */
export function providerFor(rdns?: string): Eip1193Provider | undefined {
  return pickWallet(rdns)?.provider;
}

/** Read the currently-authorized account without prompting (for silent rehydrate). */
export async function getCurrentAccount(rdns?: string): Promise<{ address: string; chainId: number } | null> {
  const chosen = pickWallet(rdns);
  if (!chosen) return null;
  const accounts = (await chosen.provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts?.length) return null;
  active = chosen.provider;
  const chainHex = (await chosen.provider.request({ method: "eth_chainId" })) as string;
  return { address: accounts[0], chainId: parseInt(chainHex, 16) };
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
