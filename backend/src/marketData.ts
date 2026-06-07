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
