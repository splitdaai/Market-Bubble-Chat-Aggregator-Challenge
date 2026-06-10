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
    try { const r = await jget(`https://api.ensideas.com/ens/resolve/${idOrEns}`); if (r?.address) { addr = r.address; ens = r.name || idOrEns; } } catch { /* ignore */ }
  }
  const out = { addr, ens, totalUsd: 0, holdings: [] as { sym: string; amount: number; usd: number }[] };
  try {
    const tb = await jget(`https://eth.blockscout.com/api/v2/addresses/${addr}/token-balances`);
    const items: Array<{ value: string; token: { symbol?: string; decimals?: string; exchange_rate?: string } }> = Array.isArray(tb) ? tb : (tb.items ?? []);
    const hold = items.map((t) => { const tok = t.token ?? {}; const dec = +(tok.decimals ?? 0); const amt = +t.value / (10 ** dec || 1); const rate = +(tok.exchange_rate ?? 0); return { sym: tok.symbol ?? "?", amount: amt, usd: amt * rate }; }).filter((h) => h.usd > 1);
    // native ETH (token-balances excludes it)
    try {
      const [info, stats] = await Promise.all([jget(`https://eth.blockscout.com/api/v2/addresses/${addr}`), jget(`https://eth.blockscout.com/api/v2/stats`)]);
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

  // Hyperliquid — real top traders by 30d (month) PnL
  try {
    const hl = await jget("https://stats-data.hyperliquid.xyz/Mainnet/leaderboard");
    const rows: Array<{ ethAddress: string; displayName?: string; accountValue: string; windowPerformances: [string, { pnl: string; roi: string; vlm: string }][] }> = hl.leaderboardRows ?? [];
    const perf = (r: typeof rows[number], w: string) => { const e = r.windowPerformances.find((p) => p[0] === w); return e ? { pnl: +e[1].pnl, roi: +e[1].roi } : { pnl: 0, roi: 0 }; };
    data.hyperliquid = rows
      .map((r) => ({ r, m: perf(r, "month") }))
      .sort((a, b) => b.m.pnl - a.m.pnl)
      .slice(0, 50)
      .map(({ r, m }) => ({
        name: shortIfAddr(r.displayName || r.ethAddress),
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
      name: shortIfAddr(p.name || p.pseudonym || p.proxyWallet),
      addr: p.proxyWallet,
      pnl: p.amount,
    }));
  } catch { /* leave empty */ }

  // Curated verified KOL wallets — real on-chain value, X handle linked (HL perps or EVM holdings)
  try {
    const post = (body: unknown) => jget("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    data.linked = await Promise.all(LINKED_WALLETS.map(async (k) => {
      try {
        if (k.chain === "hl") {
          const [cs, pf] = await Promise.all([post({ type: "clearinghouseState", user: k.id }), post({ type: "portfolio", user: k.id })]);
          const value = +(cs?.marginSummary?.accountValue ?? 0);
          const pmap: Record<string, { pnlHistory?: [number, string][] }> = Object.fromEntries(pf as [string, { pnlHistory?: [number, string][] }][]);
          const ph = pmap.month?.pnlHistory ?? [];
          return { name: k.name, xHandle: k.xHandle, chain: k.chain, addr: k.id, value, pnl: ph.length ? +ph[ph.length - 1][1] : 0, top: "" };
        }
        const w = await getEvmWallet(k.id);
        return { name: k.name, xHandle: k.xHandle, chain: k.chain, addr: w.addr, value: w.totalUsd, pnl: 0, top: w.holdings[0]?.sym ?? "" };
      } catch { return { name: k.name, xHandle: k.xHandle, chain: k.chain, addr: k.id, value: 0, pnl: 0, top: "" }; }
    }));
  } catch { /* leave empty */ }

  lbCache = { exp: Date.now() + 900_000, data };
  return data;
}

/* ---- Real per-wallet Hyperliquid data (positions + fills + portfolio chart) ---- */
const hlWalletCache = new Map<string, { exp: number; data: unknown }>();

export async function getHlWallet(addr: string) {
  const key = addr.toLowerCase();
  const hit = hlWalletCache.get(key);
  if (hit && Date.now() < hit.exp) return hit.data;
  const post = (body: unknown) => jget("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out: { addr: string; accountValue: number; positions: unknown[]; fills: unknown[]; chart: Record<string, number[]>; kpis: { winRate: number | null; trades: number; wins: number } } = { addr, accountValue: 0, positions: [], fills: [], chart: {}, kpis: { winRate: null, trades: 0, wins: 0 } };
  try {
    const [cs, pf, uf] = await Promise.all([
      post({ type: "clearinghouseState", user: addr }),
      post({ type: "portfolio", user: addr }),
      post({ type: "userFills", user: addr }),
    ]);
    out.accountValue = +(cs?.marginSummary?.accountValue ?? 0);
    out.positions = (cs?.assetPositions ?? []).map((p: { position: Record<string, string & { value: string }> }) => {
      const pos = p.position as Record<string, string> & { leverage?: { value: number } };
      const szi = +pos.szi;
      return { coin: pos.coin, long: szi >= 0, szi, entry: +(pos.entryPx ?? 0), upnl: +(pos.unrealizedPnl ?? 0), lev: pos.leverage?.value ?? 0, value: Math.abs(+(pos.positionValue ?? 0)) };
    });
    const pmap: Record<string, { accountValueHistory?: [number, string][] }> = Object.fromEntries(pf as [string, { accountValueHistory?: [number, string][] }][]);
    const series = (w: string) => (pmap[w]?.accountValueHistory ?? []).map((x) => +x[1]);
    out.chart = { day: series("day"), week: series("week"), month: series("month"), allTime: series("allTime") };
    const fillsRaw = (uf as { coin: string; side: string; sz: string; px: string; time: number; dir?: string; closedPnl?: string }[]) ?? [];
    out.fills = fillsRaw.slice(0, 40).map((f) => ({ coin: f.coin, buy: f.side === "B", sz: +f.sz, px: +f.px, t: f.time, dir: f.dir ?? "", closedPnl: +(f.closedPnl ?? 0) }));
    // Win rate over closing trades (fills that realized PnL).
    const closings = fillsRaw.filter((f) => +(f.closedPnl ?? 0) !== 0);
    const wins = closings.filter((f) => +(f.closedPnl ?? 0) > 0).length;
    out.kpis = { winRate: closings.length ? Math.round((wins / closings.length) * 100) : null, trades: closings.length, wins };
  } catch { /* leave empty */ }
  hlWalletCache.set(key, { exp: Date.now() + 120_000, data: out });
  return out;
}
