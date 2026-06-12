export type MarketClass = "crypto" | "index" | "commodity";

export interface MarketSnapshot {
  global: {
    sym: string;
    name: string;
    price: number;
    chg: number;
    spark: number[];
    cls?: MarketClass;
  }[];
  narratives: { name: string; chg24h: number; views: number; heat: number }[];
  movers: { sym: string; price: number; chg: number; vol: number }[];
  gauges: {
    fearGreed: number;
    fearGreedLabel: string;
    btcDominance: number;
    totalMcap: number;
    altSeason: number;
  };
  polymarket: { q: string; yes: number; vol: number; cat: string; end: string }[];
}

export const FALLBACK_MARKET_DATA: MarketSnapshot = {
  global: [
    { sym: "BTC", name: "Bitcoin", price: 104820, chg: 1.28, cls: "crypto", spark: [101, 102, 101.5, 103, 104, 103.7, 105, 104.8] },
    { sym: "ETH", name: "Ethereum", price: 3615, chg: 0.74, cls: "crypto", spark: [95, 96.5, 96, 97.2, 98.4, 98, 99.1, 99.4] },
    { sym: "SOL", name: "Solana", price: 158.4, chg: 2.62, cls: "crypto", spark: [78, 79, 80.5, 80, 81.8, 83.2, 82.7, 84.3] },
    { sym: "DOGE", name: "Dogecoin", price: 0.196, chg: -0.82, cls: "crypto", spark: [54, 55, 54.6, 54.2, 53.7, 53.2, 53.6, 53.1] },
    { sym: "XRP", name: "XRP", price: 2.21, chg: 0.39, cls: "crypto", spark: [67, 66.8, 67.3, 68, 67.9, 68.2, 68.7, 68.9] },
    { sym: "BNB", name: "BNB", price: 682, chg: 1.05, cls: "crypto", spark: [61, 62.4, 62, 62.8, 63.1, 63.9, 64.2, 64.1] },
    { sym: "NASDAQ", name: "Nasdaq Composite", price: 19245, chg: 0.46, cls: "index", spark: [110, 110.5, 111, 110.7, 111.8, 112.2, 112.5, 112.7] },
    { sym: "SPX", name: "S&P 500", price: 5488, chg: 0.31, cls: "index", spark: [88, 88.2, 88.5, 88.4, 89, 89.1, 89.5, 89.6] },
    { sym: "DJI", name: "Dow Jones", price: 39025, chg: -0.12, cls: "index", spark: [77, 77.1, 76.8, 76.6, 76.9, 76.7, 76.5, 76.4] },
    { sym: "RUT", name: "Russell 2000", price: 2065, chg: 0.68, cls: "index", spark: [52, 52.2, 52.9, 53.1, 53.4, 53.9, 54.2, 54.4] },
    { sym: "DXY", name: "US Dollar Index", price: 104.2, chg: -0.21, cls: "index", spark: [66, 66.2, 66.1, 65.9, 65.7, 65.8, 65.5, 65.4] },
    { sym: "GOLD", name: "Gold", price: 2342, chg: 0.55, cls: "commodity", spark: [70, 70.2, 71, 70.8, 71.4, 71.9, 72.2, 72.1] },
    { sym: "SILVER", name: "Silver", price: 29.64, chg: 1.14, cls: "commodity", spark: [44, 44.4, 44.7, 45.2, 45.1, 45.7, 46.1, 46.5] },
    { sym: "OIL", name: "WTI Crude", price: 78.2, chg: -0.43, cls: "commodity", spark: [82, 81.8, 81.2, 80.9, 80.5, 80.7, 80.2, 79.9] },
    { sym: "COPPER", name: "Copper", price: 4.61, chg: 0.26, cls: "commodity", spark: [39, 39.1, 39.4, 39.2, 39.6, 39.9, 40.1, 40] },
  ],
  narratives: [
    { name: "AI Agents", chg24h: 8.42, views: 1840000, heat: 96 },
    { name: "Solana Memes", chg24h: 5.91, views: 1490000, heat: 89 },
    { name: "Prediction Markets", chg24h: 4.18, views: 1160000, heat: 81 },
    { name: "DePIN", chg24h: 2.76, views: 730000, heat: 67 },
    { name: "RWA", chg24h: 1.34, views: 620000, heat: 58 },
    { name: "L2 Rotation", chg24h: -1.16, views: 510000, heat: 43 },
  ],
  movers: [
    { sym: "VIRTUAL", price: 2.84, chg: 14.8, vol: 184000000 },
    { sym: "WIF", price: 2.17, chg: 11.3, vol: 221000000 },
    { sym: "ONDO", price: 1.42, chg: 7.9, vol: 97000000 },
    { sym: "JUP", price: 0.92, chg: 5.6, vol: 132000000 },
    { sym: "POPCAT", price: 0.71, chg: -6.4, vol: 74000000 },
    { sym: "ARB", price: 0.81, chg: -4.2, vol: 88000000 },
    { sym: "TIA", price: 6.12, chg: -3.5, vol: 69000000 },
  ],
  gauges: {
    fearGreed: 63,
    fearGreedLabel: "Greed",
    btcDominance: 54.2,
    totalMcap: 3250000000000,
    altSeason: 47,
  },
  polymarket: [
    { q: "Will BTC close above $110K this month?", yes: 58, vol: 2200000, cat: "Crypto", end: "Jun 30" },
    { q: "Ethereum ETF weekly inflows above $1B?", yes: 43, vol: 860000, cat: "Crypto", end: "Friday" },
    { q: "Fed cuts rates at the next meeting?", yes: 22, vol: 3900000, cat: "Macro", end: "FOMC" },
  ],
};
