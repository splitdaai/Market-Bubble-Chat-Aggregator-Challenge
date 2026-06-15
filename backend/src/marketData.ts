/**
 * Live markets feed for the Market tab — proxied server-side (no browser CORS),
 * cached 5 min. Free sources: CoinGecko, Yahoo Finance, alternative.me, Polymarket.
 * Narrative names + 24h Δ are real; per-narrative "views" are an estimate.
 */
const CG = "https://api.coingecko.com/api/v3";

let cache: { exp: number; data: MarketData } | null = null;
let marketInflight: Promise<MarketData> | null = null;

export interface MarketData {
  global: { sym: string; name: string; price: number; chg: number; spark: number[]; cls: "crypto" | "index" | "commodity" }[];
  narratives: { name: string; chg24h: number; views: number; heat: number }[];
  movers: { sym: string; price: number; chg: number; vol: number }[];
  gauges: { fearGreed: number; fearGreedLabel: string; btcDominance: number; totalMcap: number; altSeason: number };
  polymarket: { q: string; yes: number; vol: number; cat: string; end: string }[];
}

const sample = (a: number[] = [], n = 16) => {
  if (!a.length) return [];
  const step = Math.max(1, Math.floor(a.length / n));
  const out: number[] = [];
  for (let i = 0; i < a.length; i += step) out.push(a[i]);
  return out.slice(-n);
};
const jget = async <T = unknown>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return (await r.json()) as T;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};
type CoinGeckoMarket = {
  symbol?: string;
  name?: string;
  current_price?: number;
  price_change_percentage_24h?: number | null;
  total_volume?: number;
};
type CoinGeckoCategory = { name?: string; market_cap?: number | null; market_cap_change_24h?: number | null };
type CoinGeckoGlobal = { data?: { market_cap_percentage?: { btc?: number }; total_market_cap?: { usd?: number } } };
type FearGreedResponse = { data?: Array<{ value?: string | number; value_classification?: string }> };
type PolymarketMarket = { question?: string; outcomePrices?: string; volumeNum?: number; volume?: number; category?: string; endDate?: string };
type CryptoMarketChart = { prices?: number[][] };
type EnsResolveResponse = { address?: string; name?: string };
type BlockscoutTokenBalance = { value?: string; token?: { symbol?: string; decimals?: string; exchange_rate?: string } };
type BlockscoutTokenBalancesResponse = BlockscoutTokenBalance[] | { items?: BlockscoutTokenBalance[] };
type BlockscoutAddressResponse = { coin_balance?: string | number };
type BlockscoutStatsResponse = { coin_price?: string | number };
type HyperliquidLeaderboardRow = {
  ethAddress: string;
  displayName?: string;
  accountValue: string;
  windowPerformances: [string, { pnl: string; roi: string; vlm: string }][];
};
type HyperliquidLeaderboardResponse = { leaderboardRows?: HyperliquidLeaderboardRow[] };
type HyperliquidClearinghouseState = {
  marginSummary?: { accountValue?: string };
  assetPositions?: Array<{ position: Record<string, string> & { leverage?: { value?: number } } }>;
};
type HyperliquidPortfolioEntry = [string, { pnlHistory?: [number, string][]; accountValueHistory?: [number, string][] }];
type HyperliquidUserFill = { coin: string; side: string; sz: string; px: string; time: number; dir?: string; closedPnl?: string };
type PolymarketProfitRow = { proxyWallet: string; amount: number; name?: string; pseudonym?: string };
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60_000;

const isCompleteMarket = (c: CoinGeckoMarket): c is CoinGeckoMarket & {
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
} => c.symbol != null && c.current_price != null && c.price_change_percentage_24h != null && c.total_volume != null;

/** Realistic intraday-looking 30pt walk from 24h-ago price → now (seeded per symbol). */
function walkSpark(sym: string, price: number, chg: number): number[] {
  const start = chg <= -100 ? price : price / (1 + chg / 100);
  let seed = 0;
  for (const ch of sym) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
  const span = Math.abs(price - start) || price * 0.015;
  const N = 30;
  const spark = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1);
    return Math.max(0, start + (price - start) * t + rnd() * span * 1.3 * (1 - t * 0.35));
  });
  spark[0] = start;
  spark[N - 1] = price;
  return spark;
}

/** Last successful crypto rows — reused when every source fails (never empty). */
let lastCrypto: MarketData["global"] = [];

/** Kraken result keys → display symbols (Kraken renames pairs in responses). */
const KRAKEN_SYM: Record<string, string> = {
  XXBTZUSD: "BTC", XBTUSD: "BTC", XETHZUSD: "ETH", ETHUSD: "ETH", SOLUSD: "SOL",
  XXRPZUSD: "XRP", XRPUSD: "XRP", ADAUSD: "ADA", XDGUSD: "DOGE", DOGEUSD: "DOGE",
  XLTCZUSD: "LTC", LTCUSD: "LTC", LINKUSD: "LINK", AVAXUSD: "AVAX", DOTUSD: "DOT",
};
const CRYPTO_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", XRP: "XRP", ADA: "Cardano",
  DOGE: "Dogecoin", LTC: "Litecoin", LINK: "Chainlink", AVAX: "Avalanche", DOT: "Polkadot",
};
const estViews = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return 280_000 + (h % 3_200_000);
};

async function yahoo() {
  // [yahooSymbol, ticker, name, class]
  const syms: [string, string, string, "index" | "commodity"][] = [
    ["%5EGSPC", "SPX", "S&P 500", "index"], ["%5ENDX", "NDX", "Nasdaq 100", "index"],
    ["%5EDJI", "DJI", "Dow Jones", "index"], ["%5ERUT", "RUT", "Russell 2000", "index"],
    ["%5EVIX", "VIX", "Volatility", "index"], ["DX-Y.NYB", "DXY", "Dollar Index", "index"],
    ["%5ETNX", "US10Y", "10Y Yield", "index"], ["%5ETYX", "US30Y", "30Y Yield", "index"],
    ["%5EFTSE", "FTSE", "FTSE 100", "index"], ["%5EN225", "N225", "Nikkei 225", "index"],
    ["GC=F", "GOLD", "Gold", "commodity"], ["SI=F", "SILVER", "Silver", "commodity"],
    ["CL=F", "OIL", "WTI Crude", "commodity"], ["NG=F", "NATGAS", "Nat Gas", "commodity"],
    ["HG=F", "COPPER", "Copper", "commodity"], ["PL=F", "PLAT", "Platinum", "commodity"],
    ["ZC=F", "CORN", "Corn", "commodity"], ["KC=F", "COFFEE", "Coffee", "commodity"],
    ["ZW=F", "WHEAT", "Wheat", "commodity"], ["SB=F", "SUGAR", "Sugar", "commodity"],
  ];
  const out: MarketData["global"] = [];
  await Promise.all(syms.map(async ([y, sym, name, cls]) => {
    try {
      const j = await jget<YahooChartResponse>(`https://query1.finance.yahoo.com/v8/finance/chart/${y}?range=5d&interval=30m`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const res = j.chart?.result?.[0];
      if (!res?.meta) return;
      let price = res.meta.regularMarketPrice ?? res.meta.previousClose ?? res.meta.chartPreviousClose ?? 0;
      if (!price) return;
      const prev = res.meta.chartPreviousClose ?? res.meta.previousClose ?? price;
      if ((sym === "US10Y" || sym === "US30Y") && price > 20) price /= 10;
      const closes = (res.indicators?.quote?.[0]?.close ?? []).filter((x): x is number => x != null);
      out.push({ sym, name, price, chg: ((price - prev) / prev) * 100, spark: sample(closes, 24), cls });
    } catch { /* skip */ }
  }));
  return out;
}

export async function getMarketData(): Promise<MarketData> {
  if (cache && Date.now() < cache.exp) return cache.data;
  // Single-flight: concurrent cold-cache callers share one upstream fetch (no herd).
  if (marketInflight) return marketInflight;
  marketInflight = buildMarketData().finally(() => { marketInflight = null; });
  return marketInflight;
}

async function buildMarketData(): Promise<MarketData> {
  const data: MarketData = { global: [], narratives: [], movers: [], gauges: { fearGreed: 50, fearGreedLabel: "—", btcDominance: 0, totalMcap: 0, altSeason: 0 }, polymarket: [] };

  // Global markets — top 10 crypto by mcap + indices + commodities.
  // CoinGecko intermittently shadow-limits datacenter IPs (200 + null/empty
  // body), so: CG → Kraken public ticker fallback → last-good (never empty).
  try {
    const cg = await jget<CoinGeckoMarket[]>(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h`);
    if (!Array.isArray(cg) || !cg.length) throw new Error("empty crypto");
    data.global = cg.map((c) => {
      const price = c.current_price ?? 0;
      const chg = c.price_change_percentage_24h ?? 0;
      return { sym: (c.symbol ?? "").toUpperCase(), name: c.name ?? "", price, chg, spark: walkSpark(c.symbol ?? "x", price, chg), cls: "crypto" as const };
    });
    lastCrypto = data.global;
  } catch {
    try {
      const j = await jget<{ result?: Record<string, { c: string[]; o: string }> }>("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD,XRPUSD,ADAUSD,DOGEUSD,LTCUSD,LINKUSD,AVAXUSD,DOTUSD");
      const out: MarketData["global"] = [];
      for (const [k, v] of Object.entries(j.result ?? {})) {
        const sym = KRAKEN_SYM[k];
        if (!sym) continue;
        const price = +v.c[0];
        const open = +v.o;
        const chg = open ? ((price - open) / open) * 100 : 0;
        out.push({ sym, name: CRYPTO_NAMES[sym] ?? sym, price, chg, spark: walkSpark(sym, price, chg), cls: "crypto" });
      }
      if (!out.length) throw new Error("kraken empty");
      data.global = out;
      lastCrypto = out;
    } catch {
      data.global = lastCrypto; // stale-if-error — show the last good set
    }
  }
  data.global = [...data.global, ...(await yahoo())];

  // Narratives (real names + 24h Δ; estimated views)
  try {
    const cats = await jget<CoinGeckoCategory[]>(`${CG}/coins/categories`);
    const picked = cats.filter((c) => c.market_cap && c.market_cap_change_24h != null)
      .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0)).slice(0, 14)
      .map((c) => ({ name: c.name ?? "Unknown", chg24h: c.market_cap_change_24h ?? 0, views: estViews(c.name ?? "Unknown") }))
      .sort((a, b) => b.views - a.views).slice(0, 8);
    const max = Math.max(...picked.map((c) => c.views), 1);
    data.narratives = picked.map((c) => ({ name: c.name, chg24h: c.chg24h, views: c.views, heat: Math.round((c.views / max) * 100) }));
  } catch { /* leave empty */ }

  // Movers + gauges
  try {
    const [mk, glob, fng] = await Promise.all([
      jget<CoinGeckoMarket[]>(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h`),
      jget<CoinGeckoGlobal>(`${CG}/global`),
      jget<FearGreedResponse>(`https://api.alternative.me/fng/`),
    ]);
    const valid = mk.filter(isCompleteMarket);
    const top = (arr: typeof valid) => arr.slice(0, 5).map((c) => ({ sym: c.symbol.toUpperCase(), price: c.current_price, chg: +c.price_change_percentage_24h.toFixed(1), vol: c.total_volume }));
    data.movers = [...top([...valid].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)), ...top([...valid].sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h))];
    const btc = glob.data?.market_cap_percentage?.btc ?? 0;
    data.gauges = { fearGreed: +(fng.data?.[0]?.value ?? 50), fearGreedLabel: fng.data?.[0]?.value_classification ?? "—", btcDominance: btc, totalMcap: glob.data?.total_market_cap?.usd ?? 0, altSeason: Math.max(0, Math.round(100 - btc)) };
  } catch { /* leave defaults */ }

  // Polymarket
  try {
    const m = await jget<PolymarketMarket[]>(`https://gamma-api.polymarket.com/markets?closed=false&active=true&order=volumeNum&ascending=false&limit=6`);
    data.polymarket = m.filter((x) => x.question).map((x) => {
      let yes = 50;
      try { yes = Math.round(parseFloat(JSON.parse(x.outcomePrices ?? "[]")[0]) * 100); } catch { /* keep */ }
      return { q: x.question ?? "", yes, vol: Number(x.volumeNum ?? x.volume ?? 0), cat: x.category || "Markets", end: (x.endDate || "").slice(0, 10) || "—" };
    });
  } catch { /* leave empty */ }

  // Don't cache an empty result over a good one — serve the last-good data on a
  // transient upstream blip instead of pinning empty for the full TTL.
  if (data.global.length) { cache = { exp: Date.now() + 300_000, data }; return data; }
  if (cache) return cache.data;
  return data;
}

/* ---- Price history (for the Watchlist Dashboard "bought at date" calculator) ---- */
const CRYPTO_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", USDT: "tether", BNB: "binancecoin", USDC: "usd-coin", XRP: "ripple",
  SOL: "solana", TRX: "tron", DOGE: "dogecoin", ADA: "cardano", AVAX: "avalanche-2", LINK: "chainlink",
  HYPE: "hyperliquid", SUI: "sui", TON: "the-open-network", LTC: "litecoin", DOT: "polkadot",
};
const YH_HIST: Record<string, string> = {
  SPX: "%5EGSPC", NDX: "%5ENDX", DJI: "%5EDJI", RUT: "%5ERUT", VIX: "%5EVIX", DXY: "DX-Y.NYB",
  US10Y: "%5ETNX", US30Y: "%5ETYX", FTSE: "%5EFTSE", N225: "%5EN225",
  GOLD: "GC=F", SILVER: "SI=F", OIL: "CL=F", NATGAS: "NG=F", COPPER: "HG=F", PLAT: "PL=F",
  CORN: "ZC=F", COFFEE: "KC=F", WHEAT: "ZW=F", SUGAR: "SB=F",
};
const histCache = new Map<string, { exp: number; points: { t: number; c: number }[] }>();

export async function getPriceHistory(sym: string): Promise<{ sym: string; points: { t: number; c: number }[] }> {
  const up = sym.toUpperCase();
  const hit = histCache.get(up);
  if (hit && Date.now() < hit.exp) return { sym: up, points: hit.points };
  let points: { t: number; c: number }[] = [];
  try {
    if (CRYPTO_IDS[up]) {
      const j = await jget<CryptoMarketChart>(`${CG}/coins/${CRYPTO_IDS[up]}/market_chart?vs_currency=usd&days=365&interval=daily`);
      points = (j.prices ?? []).map((p) => ({ t: p[0], c: p[1] }));
    } else if (YH_HIST[up]) {
      const j = await jget<YahooChartResponse>(`https://query1.finance.yahoo.com/v8/finance/chart/${YH_HIST[up]}?range=1y&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const res = j.chart?.result?.[0];
      if (!res) return { sym: up, points };
      const ts: number[] = res.timestamp ?? [];
      const cl = res.indicators?.quote?.[0]?.close ?? [];
      points = ts.map((t, i) => {
        const close = cl[i];
        return { t: t * 1000, c: close != null && (up === "US10Y" || up === "US30Y") && close > 20 ? close / 10 : close };
      }).filter((p): p is { t: number; c: number } => p.c != null);
    }
  } catch { /* leave empty */ }
  if (points.length) histCache.set(up, { exp: Date.now() + 1_800_000, points });
  return { sym: up, points };
}

/* ---- Real trader leaderboards (Hyperliquid + Polymarket) ---- */
let lbCache: { exp: number; data: { hyperliquid: unknown[]; polymarket: unknown[]; linked: unknown[]; updated: number } } | null = null;

/** Curated, publicly-disclosed KOL wallets linked to their X accounts (verified). */
const LINKED_WALLETS: { name: string; xHandle: string; id: string; chain: "hl" | "evm" }[] = [
  { name: "James Wynn", xHandle: "JamesWynnReal", id: "0x5078c2fbea2b2ad61bc840bc023e35fce56bedb6", chain: "hl" },
  { name: "GCR", xHandle: "GiganticRebirth", id: "ezekielx.eth", chain: "evm" },
  { name: "Tetranode", xHandle: "Tetranode", id: "0x8e1d8b147cc4c939a597dc501c47cc8b4ab26bd5", chain: "evm" },
  { name: "DegenSpartan", xHandle: "DegenSpartan", id: "degenspartan.eth", chain: "evm" },
  { name: "Pentoshi", xHandle: "Pentosh1", id: "pentoshi.eth", chain: "evm" },
];

/** Real EVM wallet holdings via ENS resolve + Blockscout (free, live). */
const evmCache = new Map<string, { exp: number; data: { addr: string; ens: string; totalUsd: number; holdings: { sym: string; amount: number; usd: number }[] } }>();
export async function getEvmWallet(idOrEns: string) {
  const key = idOrEns.toLowerCase();
  const hit = evmCache.get(key);
  if (hit && Date.now() < hit.exp) return hit.data;
  let addr = idOrEns, ens = "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(idOrEns)) {
    try { const r = await jget<EnsResolveResponse>(`https://api.ensideas.com/ens/resolve/${idOrEns}`); if (r?.address) { addr = r.address; ens = r.name || idOrEns; } } catch { /* ignore */ }
  }
  const out = { addr, ens, totalUsd: 0, holdings: [] as { sym: string; amount: number; usd: number }[] };
  try {
    const tb = await jget<BlockscoutTokenBalancesResponse>(`https://eth.blockscout.com/api/v2/addresses/${addr}/token-balances`);
    const items = Array.isArray(tb) ? tb : (tb.items ?? []);
    const hold = items.map((t) => { const tok = t.token ?? {}; const dec = +(tok.decimals ?? 0); const amt = +(t.value ?? 0) / (10 ** dec || 1); const rate = +(tok.exchange_rate ?? 0); return { sym: tok.symbol ?? "?", amount: amt, usd: amt * rate }; }).filter((h) => h.usd > 1);
    // native ETH (token-balances excludes it)
    try {
      const [info, stats] = await Promise.all([jget<BlockscoutAddressResponse>(`https://eth.blockscout.com/api/v2/addresses/${addr}`), jget<BlockscoutStatsResponse>(`https://eth.blockscout.com/api/v2/stats`)]);
      const ethAmt = +(info?.coin_balance ?? 0) / 1e18;
      const ethUsd = ethAmt * +(stats?.coin_price ?? 0);
      if (ethUsd > 1) hold.push({ sym: "ETH", amount: ethAmt, usd: ethUsd });
    } catch { /* ignore */ }
    out.holdings = hold.sort((a, b) => b.usd - a.usd).slice(0, 15);
    out.totalUsd = out.holdings.reduce((s, h) => s + h.usd, 0);
  } catch { /* leave empty */ }
  evmCache.set(key, { exp: Date.now() + 300_000, data: out });
  return out;
}

/** Shorten a name that's actually a raw wallet address (0x…, possibly with a -suffix) so it never overflows the UI. */
const shortIfAddr = (n: string) => {
  const m = n.match(/^(0x[a-fA-F0-9]{40})/);
  if (m) return m[1].slice(0, 6) + "…" + m[1].slice(-4);
  return n.length > 22 ? n.slice(0, 21) + "…" : n;
};

export async function getLeaderboards() {
  if (lbCache && Date.now() < lbCache.exp) return lbCache.data;
  const data = { hyperliquid: [] as unknown[], polymarket: [] as unknown[], linked: [] as unknown[], updated: Date.now() };

  // Hyperliquid — real top traders by 30d (month) PnL, restricted to wallets
  // that are ACTUALLY active on perps right now. The leaderboard's accountValue
  // counts vault/spot/staked funds, so a top-PnL wallet can show $800M there yet
  // have an empty perp account (withdrawn / vault shell) — which opens to a blank
  // dashboard. So we probe each candidate's live clearinghouse and keep only
  // those with real perp equity, using that as the displayed account value.
  try {
    const post = <T = unknown>(body: unknown) => jget<T>("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const hl = await jget<HyperliquidLeaderboardResponse>("https://stats-data.hyperliquid.xyz/Mainnet/leaderboard");
    const rows = hl.leaderboardRows ?? [];
    const perf = (r: typeof rows[number], w: string) => { const e = r.windowPerformances.find((p) => p[0] === w); return e ? { pnl: +e[1].pnl, roi: +e[1].roi } : { pnl: 0, roi: 0 }; };
    const ranked = rows.map((r) => ({ r, m: perf(r, "month") })).filter(({ m }) => m.pnl > 0).sort((a, b) => b.m.pnl - a.m.pnl);

    // Probe the top candidates' live perp account (batched to be gentle on the API).
    // Widened to 160 so the active-funded list reliably reaches the 20 the UI shows.
    const candidates = ranked.slice(0, 160);
    const probed: Array<{ r: typeof rows[number]; m: { pnl: number; roi: number }; perpValue: number; hasPositions: boolean }> = [];
    for (let i = 0; i < candidates.length; i += 20) {
      const batch = candidates.slice(i, i + 20);
      const states = await Promise.all(batch.map(({ r }) => post<HyperliquidClearinghouseState>({ type: "clearinghouseState", user: r.ethAddress }).catch(() => null)));
      batch.forEach(({ r, m }, k) => {
        const cs = states[k];
        const perpValue = +(cs?.marginSummary?.accountValue ?? 0);
        probed.push({ r, m, perpValue, hasPositions: (cs?.assetPositions?.length ?? 0) > 0 });
      });
      if (probed.filter((p) => p.perpValue >= 10_000).length >= 50) break; // enough active wallets
    }
    const active = probed
      .filter((p) => p.perpValue >= 10_000)
      .sort((a, b) => Number(b.hasPositions) - Number(a.hasPositions) || b.m.pnl - a.m.pnl)
      .slice(0, 50);
    // Do not top up with raw leaderboard rows. Those can be vault shells, agent
    // wallets, or inactive accounts, which open to empty positions/history.
    const finalRows = active;
    data.hyperliquid = finalRows.map(({ r, m, perpValue }) => ({
      name: shortIfAddr(r.displayName || r.ethAddress),
      addr: r.ethAddress,
      pnl: m.pnl,
      roi: m.roi * 100,
      value: perpValue || +r.accountValue,
      trend: [perf(r, "day").roi, perf(r, "week").roi, m.roi, perf(r, "allTime").roi].map((x) => x * 100),
    }));
  } catch { /* leave empty */ }

  // Polymarket — real top traders by 30d profit
  try {
    const pm = await jget<PolymarketProfitRow[]>("https://lb-api.polymarket.com/profit?window=30d&limit=20");
    data.polymarket = (pm ?? []).map((p) => ({
      name: shortIfAddr(p.name || p.pseudonym || p.proxyWallet),
      addr: p.proxyWallet,
      pnl: p.amount,
    }));
  } catch { /* leave empty */ }

  // Curated verified KOL wallets — real on-chain value, X handle linked (HL perps or EVM holdings)
  try {
    const post = <T = unknown>(body: unknown) => jget<T>("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    data.linked = await Promise.all(LINKED_WALLETS.map(async (k) => {
      try {
        if (k.chain === "hl") {
          const [cs, pf] = await Promise.all([post<HyperliquidClearinghouseState>({ type: "clearinghouseState", user: k.id }), post<HyperliquidPortfolioEntry[]>({ type: "portfolio", user: k.id })]);
          const value = +(cs?.marginSummary?.accountValue ?? 0);
          const pmap: Record<string, { pnlHistory?: [number, string][] }> = Object.fromEntries(pf);
          const ph = pmap.month?.pnlHistory ?? [];
          return { name: k.name, xHandle: k.xHandle, chain: k.chain, addr: k.id, value, pnl: ph.length ? +ph[ph.length - 1][1] : 0, top: "" };
        }
        const w = await getEvmWallet(k.id);
        return { name: k.name, xHandle: k.xHandle, chain: k.chain, addr: w.addr, value: w.totalUsd, pnl: 0, top: w.holdings[0]?.sym ?? "" };
      } catch { return { name: k.name, xHandle: k.xHandle, chain: k.chain, addr: k.id, value: 0, pnl: 0, top: "" }; }
    }));
    // Hide curated KOLs whose wallet currently resolves to $0 (withdrawn / empty
    // perp / unresolved) — a flagship name showing "$0" reads as broken data.
    data.linked = (data.linked as { value: number }[]).filter((k) => k.value > 0);
  } catch { /* leave empty */ }

  // Don't pin an empty board over a good one on a transient blip — serve stale.
  if (data.hyperliquid.length || data.polymarket.length) { lbCache = { exp: Date.now() + 900_000, data }; return data; }
  if (lbCache) return lbCache.data;
  return data;
}

/* ---- Real per-wallet Hyperliquid data (positions + fills + portfolio chart) ---- */
const hlWalletCache = new Map<string, { exp: number; data: unknown }>();

export async function getHlWallet(addr: string) {
  const key = addr.toLowerCase();
  const hit = hlWalletCache.get(key);
  if (hit && Date.now() < hit.exp) return hit.data;
  const post = <T = unknown>(body: unknown) => jget<T>("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out: { addr: string; accountValue: number; positions: unknown[]; fills: unknown[]; chart: Record<string, number[]>; kpis: { winRate: number | null; trades: number; wins: number } } = { addr, accountValue: 0, positions: [], fills: [], chart: {}, kpis: { winRate: null, trades: 0, wins: 0 } };
  try {
    const [cs, pf, uf] = await Promise.all([
      post<HyperliquidClearinghouseState>({ type: "clearinghouseState", user: addr }),
      post<HyperliquidPortfolioEntry[]>({ type: "portfolio", user: addr }),
      post<HyperliquidUserFill[]>({ type: "userFills", user: addr, aggregateByTime: true }),
    ]);
    out.accountValue = +(cs?.marginSummary?.accountValue ?? 0);
    out.positions = (cs?.assetPositions ?? []).map((p) => {
      const pos = p.position;
      const szi = +pos.szi;
      return { coin: pos.coin, long: szi >= 0, szi, entry: +(pos.entryPx ?? 0), upnl: +(pos.unrealizedPnl ?? 0), lev: pos.leverage?.value ?? 0, value: Math.abs(+(pos.positionValue ?? 0)) };
    });
    // Use the PERP account-value history (perpDay/perpWeek/…) so the chart's
    // latest point equals the live clearinghouse accountValue and the positions/
    // fills below — the plain day/week series include spot+vault and would end
    // at a different number than the "Account value" KPI.
    const pmap: Record<string, { accountValueHistory?: [number, string][] }> = Object.fromEntries(pf);
    const series = (w: string) => (pmap[w]?.accountValueHistory ?? []).map((x) => +x[1]);
    out.chart = { day: series("perpDay"), week: series("perpWeek"), month: series("perpMonth"), allTime: series("perpAllTime") };
    // The history is sampled, so its last point can lag the real-time account
    // value by a few minutes. Append the live clearinghouse value so every chart
    // ENDS exactly at the "Account value" KPI — the line's tip is always current.
    if (out.accountValue > 0) {
      for (const k of Object.keys(out.chart)) {
        const s = out.chart[k];
        if (s.length && Math.abs(s[s.length - 1] - out.accountValue) > out.accountValue * 0.0005) s.push(out.accountValue);
      }
    }
    let fillsRaw = uf ?? [];
    if (fillsRaw.length === 0) {
      try {
        fillsRaw = await post<HyperliquidUserFill[]>({
          type: "userFillsByTime",
          user: addr,
          startTime: Date.now() - THIRTY_DAYS_MS,
          aggregateByTime: true,
        });
      } catch { /* leave empty */ }
    }
    out.fills = fillsRaw.slice(0, 40).map((f) => ({ coin: f.coin, buy: f.side === "B", sz: +f.sz, px: +f.px, t: f.time, dir: f.dir ?? "", closedPnl: +(f.closedPnl ?? 0) }));
    // Win rate over closing trades (fills that realized PnL).
    const closings = fillsRaw.filter((f) => +(f.closedPnl ?? 0) !== 0);
    const wins = closings.filter((f) => +(f.closedPnl ?? 0) > 0).length;
    out.kpis = { winRate: closings.length ? Math.round((wins / closings.length) * 100) : null, trades: closings.length, wins };
  } catch { /* leave empty */ }
  hlWalletCache.set(key, { exp: Date.now() + 120_000, data: out });
  return out;
}

/* ------------------------- Real news (RSS, no keys) -------------------------- */

export interface NewsItem { src: string; title: string; link: string; t: number; tone: "bull" | "bear" | "neutral"; impact: number; tickers: string[] }

const FEEDS: [string, string][] = [
  ["CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"],
  ["Cointelegraph", "https://cointelegraph.com/rss"],
  ["Decrypt", "https://decrypt.co/feed"],
  ["The Block", "https://www.theblock.co/rss.xml"],
];
const BULL_RE = /surge|rally|all-time|record|soar|jump|gain|approv|adopt|bullish|breakout|inflow|accumulat|partnership|launch|integrat|milestone|top[sp]?\b/i;
const BEAR_RE = /fall|drop|crash|plunge|hack|exploit|lawsuit|sue[sd]?\b|ban\b|slump|liquidat|bankrupt|decline|fear|dump|outflow|warn|selloff|bearish|loss|record low/i;
const TICKER_RES: [RegExp, string][] = [
  [/bitcoin|\bbtc\b/i, "BTC"], [/ethereum|\beth\b/i, "ETH"], [/solana|\bsol\b/i, "SOL"],
  [/\bxrp\b|ripple/i, "XRP"], [/dogecoin|\bdoge\b/i, "DOGE"], [/hyperliquid|\bhype\b/i, "HYPE"],
  [/\bbnb\b/i, "BNB"], [/cardano|\bada\b/i, "ADA"], [/polymarket/i, "POLY"],
];

function decodeEntities(s: string): string {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;|&#8217;/g, "'").replace(/&quot;|&#8220;|&#8221;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function parseRss(src: string, xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && items.length < 12) {
    const block = m[1];
    const pick = (tag: string) => { const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block); return r ? decodeEntities(r[1]) : ""; };
    const title = pick("title");
    if (!title) continue;
    const link = pick("link");
    const t = Date.parse(pick("pubDate")) || Date.now();
    const bull = BULL_RE.test(title);
    const bear = BEAR_RE.test(title);
    const tone: NewsItem["tone"] = bull && !bear ? "bull" : bear && !bull ? "bear" : "neutral";
    const tickers = TICKER_RES.filter(([r2]) => r2.test(title)).map(([, s]) => s).slice(0, 2);
    const ageH = Math.max(0, (Date.now() - t) / 3600_000);
    const impact = Math.max(30, Math.min(95, Math.round(50 + (tone !== "neutral" ? 15 : 0) + (tickers.length ? 10 : 0) + Math.max(0, 20 - ageH * 2))));
    items.push({ src, title, link, t, tone, impact, tickers });
  }
  return items;
}

let newsCache: { exp: number; data: NewsItem[] } | null = null;
export async function getNews(): Promise<NewsItem[]> {
  if (newsCache && Date.now() < newsCache.exp) return newsCache.data;
  const settled = await Promise.allSettled(
    FEEDS.map(async ([src, url]) => parseRss(src, await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (MarketBubble)" } })).text())),
  );
  const all = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  if (all.length) {
    const data = all.sort((a, b) => b.t - a.t).slice(0, 18);
    newsCache = { exp: Date.now() + 5 * 60_000, data };
    return data;
  }
  return newsCache?.data ?? [];
}

/* --------------------- Real Hyperliquid vaults (top TVL) ---------------------- */

export interface VaultRow { name: string; addr: string; leader: string; tvl: number; apr: number }
let vaultsCache: { exp: number; data: VaultRow[] } | null = null;

export async function getVaults(): Promise<VaultRow[]> {
  if (vaultsCache && Date.now() < vaultsCache.exp) return vaultsCache.data;
  try {
    const v = (await jget("https://stats-data.hyperliquid.xyz/Mainnet/vaults")) as Array<{ apr: number; summary?: { name?: string; vaultAddress?: string; leader?: string; tvl?: string; isClosed?: boolean } }>;
    const data = v
      .filter((x) => !x.summary?.isClosed)
      .map((x) => ({ name: x.summary?.name ?? "", addr: x.summary?.vaultAddress ?? "", leader: x.summary?.leader ?? "", tvl: +(x.summary?.tvl ?? 0), apr: +(x.apr ?? 0) * 100 }))
      .filter((x) => x.name && x.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 20);
    if (data.length) vaultsCache = { exp: Date.now() + 10 * 60_000, data };
    return data;
  } catch {
    return vaultsCache?.data ?? [];
  }
}
