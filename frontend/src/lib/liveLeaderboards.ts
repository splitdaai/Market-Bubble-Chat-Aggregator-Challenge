export interface LiveHlRow {
  name: string;
  addr?: string;
  pnl: number;
  roi?: number;
  value?: number;
  trend?: number[];
}

export interface LivePolyRow {
  name: string;
  addr?: string;
  pnl: number;
}

export interface LiveVaultRow {
  name: string;
  addr: string;
  leader: string;
  tvl: number;
  apr: number;
}

export interface LiveLeaderboards {
  hyperliquid: LiveHlRow[];
  polymarket: LivePolyRow[];
  updated: number;
}

type HlLeaderboardRow = {
  ethAddress: string;
  displayName?: string | null;
  accountValue?: string;
  windowPerformances?: [string, { pnl?: string; roi?: string }][];
};

type HlLeaderboardResponse = { leaderboardRows?: HlLeaderboardRow[] };
type PolyProfitRow = { proxyWallet?: string; amount?: number; name?: string; pseudonym?: string };
type VaultApiRow = {
  apr?: number;
  summary?: { name?: string; vaultAddress?: string; leader?: string; tvl?: string; isClosed?: boolean };
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as T;
}

function shortName(name: string): string {
  const wallet = name.match(/^(0x[a-fA-F0-9]{40})/);
  if (wallet) return `${wallet[1].slice(0, 6)}…${wallet[1].slice(-4)}`;
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}

function perf(row: HlLeaderboardRow, window: string): { pnl: number; roi: number } {
  const entry = row.windowPerformances?.find((item) => item[0] === window);
  return { pnl: +(entry?.[1]?.pnl ?? 0), roi: +(entry?.[1]?.roi ?? 0) };
}

export async function fetchDirectLeaderboards(): Promise<LiveLeaderboards> {
  const [hlResult, polyResult] = await Promise.allSettled([
    json<HlLeaderboardResponse>("https://stats-data.hyperliquid.xyz/Mainnet/leaderboard"),
    json<PolyProfitRow[]>("https://lb-api.polymarket.com/profit?window=30d&limit=20"),
  ]);

  const hyperliquid = hlResult.status === "fulfilled"
    ? (hlResult.value.leaderboardRows ?? [])
      .map((row) => ({ row, month: perf(row, "month") }))
      .filter(({ row, month }) => row.ethAddress && month.pnl > 0)
      .sort((a, b) => b.month.pnl - a.month.pnl)
      .slice(0, 24)
      .map(({ row, month }) => ({
        name: shortName(row.displayName || row.ethAddress),
        addr: row.ethAddress,
        pnl: month.pnl,
        roi: month.roi * 100,
        value: +(row.accountValue ?? 0),
        trend: [perf(row, "day").roi, perf(row, "week").roi, month.roi, perf(row, "allTime").roi].map((value) => value * 100),
      }))
    : [];

  const polymarket = polyResult.status === "fulfilled"
    ? (polyResult.value ?? [])
      .filter((row) => row.proxyWallet && Number.isFinite(row.amount))
      .slice(0, 20)
      .map((row) => ({
        name: shortName(row.name || row.pseudonym || row.proxyWallet || "Polymarket trader"),
        addr: row.proxyWallet,
        pnl: row.amount ?? 0,
      }))
    : [];

  if (!hyperliquid.length && !polymarket.length) throw new Error("direct leaderboard sources unavailable");
  return { hyperliquid, polymarket, updated: Date.now() };
}

export async function fetchDirectVaults(): Promise<LiveVaultRow[]> {
  const rows = await json<VaultApiRow[]>("https://stats-data.hyperliquid.xyz/Mainnet/vaults");
  const vaults = rows
    .filter((row) => !row.summary?.isClosed)
    .map((row) => ({
      name: row.summary?.name ?? "",
      addr: row.summary?.vaultAddress ?? "",
      leader: row.summary?.leader ?? "",
      tvl: +(row.summary?.tvl ?? 0),
      apr: +(row.apr ?? 0) * 100,
    }))
    .filter((row) => row.name && row.addr && row.tvl > 0)
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 20);
  if (!vaults.length) throw new Error("direct vault source unavailable");
  return vaults;
}
