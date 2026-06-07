/**
 * Live markets feed for the Market tab — proxied server-side (no browser CORS),
 * cached 5 min. Free sources: CoinGecko, Yahoo Finance, alternative.me, Polymarket.
 * Narrative names + 24h Δ are real; per-narrative "views" are an estimate.
 */
const CG = "https://api.coingecko.com/api/v3";

let cache: { exp: number; data: MarketData } | null = null;

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
const jget = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
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
      const j = await jget(`https://query1.finance.yahoo.com/v8/finance/chart/${y}?range=5d&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const res = j.chart.result[0];
      let price = res.meta.regularMarketPrice;
      const prev = res.meta.chartPreviousClose ?? res.meta.previousClose ?? price;
      if ((sym === "US10Y" || sym === "US30Y") && price > 20) price /= 10;
      const closes = (res.indicators.quote[0].close ?? []).filter((x: number) => x != null);
      out.push({ sym, name, price, chg: ((price - prev) / prev) * 100, spark: sample(closes, 12), cls });
    } catch { /* skip */ }
  }));
  return out;
}

export async function getMarketData(): Promise<MarketData> {
  if (cache && Date.now() < cache.exp) return cache.data;

  const data: MarketData = { global: [], narratives: [], movers: [], gauges: { fearGreed: 50, fearGreedLabel: "—", btcDominance: 0, totalMcap: 0, altSeason: 0 }, polymarket: [] };

  // Global markets — top 10 crypto by mcap + indices + commodities
  try {
    const cg = await jget(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h&sparkline=true`);
    data.global = cg.map((c: Record<string, number & string & { price: number[] }>) => ({
      sym: (c.symbol as unknown as string).toUpperCase(), name: c.name as unknown as string,
      price: c.current_price as unknown as number, chg: (c.price_change_percentage_24h as unknown as number) ?? 0,
      spark: sample((c.sparkline_in_7d as unknown as { price: number[] })?.price ?? []), cls: "crypto" as const,
    }));
  } catch { /* leave empty */ }
  data.global = [...data.global, ...(await yahoo())];

  // Narratives (real names + 24h Δ; estimated views)
  try {
    const cats: Array<{ name: string; market_cap: number; market_cap_change_24h: number }> = await jget(`${CG}/coins/categories`);
    const picked = cats.filter((c) => c.market_cap && c.market_cap_change_24h != null)
      .sort((a, b) => b.market_cap - a.market_cap).slice(0, 14)
      .map((c) => ({ name: c.name, chg24h: c.market_cap_change_24h, views: estViews(c.name) }))
      .sort((a, b) => b.views - a.views).slice(0, 8);
    const max = Math.max(...picked.map((c) => c.views), 1);
    data.narratives = picked.map((c) => ({ name: c.name, chg24h: c.chg24h, views: c.views, heat: Math.round((c.views / max) * 100) }));
  } catch { /* leave empty */ }

  // Movers + gauges
  try {
    const [mk, glob, fng] = await Promise.all([
      jget(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h`),
      jget(`${CG}/global`),
      jget(`https://api.alternative.me/fng/`),
    ]);
    const valid = (mk as Array<{ symbol: string; current_price: number; price_change_percentage_24h: number; total_volume: number }>).filter((c) => c.price_change_percentage_24h != null);
    const top = (arr: typeof valid) => arr.slice(0, 5).map((c) => ({ sym: c.symbol.toUpperCase(), price: c.current_price, chg: +c.price_change_percentage_24h.toFixed(1), vol: c.total_volume }));
    data.movers = [...top([...valid].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)), ...top([...valid].sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h))];
    const btc = glob.data.market_cap_percentage.btc;
    data.gauges = { fearGreed: +(fng.data?.[0]?.value ?? 50), fearGreedLabel: fng.data?.[0]?.value_classification ?? "—", btcDominance: btc, totalMcap: glob.data.total_market_cap.usd, altSeason: Math.max(0, Math.round(100 - btc)) };
  } catch { /* leave defaults */ }

  // Polymarket
  try {
    const m: Array<{ question: string; outcomePrices: string; volumeNum?: number; volume?: number; category?: string; endDate?: string }> = await jget(`https://gamma-api.polymarket.com/markets?closed=false&active=true&order=volumeNum&ascending=false&limit=6`);
    data.polymarket = m.map((x) => {
      let yes = 50;
      try { yes = Math.round(parseFloat(JSON.parse(x.outcomePrices)[0]) * 100); } catch { /* keep */ }
      return { q: x.question, yes, vol: Number(x.volumeNum ?? x.volume ?? 0), cat: x.category || "Markets", end: (x.endDate || "").slice(0, 10) || "—" };
    });
  } catch { /* leave empty */ }

  cache = { exp: Date.now() + 300_000, data };
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
      const j = await jget(`${CG}/coins/${CRYPTO_IDS[up]}/market_chart?vs_currency=usd&days=365&interval=daily`);
      points = ((j.prices as number[][]) ?? []).map((p) => ({ t: p[0], c: p[1] }));
    } else if (YH_HIST[up]) {
      const j = await jget(`https://query1.finance.yahoo.com/v8/finance/chart/${YH_HIST[up]}?range=1y&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const res = j.chart.result[0];
      const ts: number[] = res.timestamp ?? [];
      const cl: number[] = res.indicators.quote[0].close ?? [];
      points = ts.map((t, i) => ({ t: t * 1000, c: (up === "US10Y" || up === "US30Y") && cl[i] > 20 ? cl[i] / 10 : cl[i] })).filter((p) => p.c != null);
    }
  } catch { /* leave empty */ }
  if (points.length) histCache.set(up, { exp: Date.now() + 1_800_000, points });
  return { sym: up, points };
}

/* ---- Real trader leaderboards (Hyperliquid + Polymarket) ---- */
let lbCache: { exp: number; data: { hyperliquid: unknown[]; polymarket: unknown[]; updated: number } } | null = null;

export async function getLeaderboards() {
  if (lbCache && Date.now() < lbCache.exp) return lbCache.data;
  const data = { hyperliquid: [] as unknown[], polymarket: [] as unknown[], updated: Date.now() };

  // Hyperliquid — real top traders by 30d (month) PnL
  try {
    const hl = await jget("https://stats-data.hyperliquid.xyz/Mainnet/leaderboard");
    const rows: Array<{ ethAddress: string; displayName?: string; accountValue: string; windowPerformances: [string, { pnl: string; roi: string; vlm: string }][] }> = hl.leaderboardRows ?? [];
    const perf = (r: typeof rows[number], w: string) => { const e = r.windowPerformances.find((p) => p[0] === w); return e ? { pnl: +e[1].pnl, roi: +e[1].roi } : { pnl: 0, roi: 0 }; };
    data.hyperliquid = rows
      .map((r) => ({ r, m: perf(r, "month") }))
      .sort((a, b) => b.m.pnl - a.m.pnl)
      .slice(0, 20)
      .map(({ r, m }) => ({
        name: r.displayName || r.ethAddress.slice(0, 6) + "…" + r.ethAddress.slice(-4),
        addr: r.ethAddress,
        pnl: m.pnl,
        roi: m.roi * 100,
        value: +r.accountValue,
        trend: [perf(r, "day").roi, perf(r, "week").roi, m.roi, perf(r, "allTime").roi].map((x) => x * 100),
      }));
  } catch { /* leave empty */ }

  // Polymarket — real top traders by 30d profit
  try {
    const pm: Array<{ proxyWallet: string; amount: number; name?: string; pseudonym?: string }> = await jget("https://lb-api.polymarket.com/profit?window=30d&limit=20");
    data.polymarket = (pm ?? []).map((p) => ({
      name: p.name || p.pseudonym || p.proxyWallet.slice(0, 6) + "…" + p.proxyWallet.slice(-4),
      addr: p.proxyWallet,
      pnl: p.amount,
    }));
  } catch { /* leave empty */ }

  lbCache = { exp: Date.now() + 900_000, data };
  return data;
}
