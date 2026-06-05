/**
 * Polymarket data via the public Gamma API (CORS-open). We pull active events
 * (ordered by 24h volume), derive a representative outcome + price, and bucket
 * each into the dashboard's categories from its Polymarket tags.
 */

export const POLY_CATEGORIES = [
  "politics", "elections", "geopolitics", "iran", "economy", "finance",
  "crypto", "tech", "sports", "esports", "culture", "weather", "mentions",
] as const;
export type PolyCategory = (typeof POLY_CATEGORIES)[number];

/** Tag-slug keywords that map a Polymarket event into each category. */
const CATEGORY_TAGS: Record<PolyCategory, string[]> = {
  politics: ["politics", "us-politics", "trump", "biden", "congress", "senate", "white-house", "supreme-court"],
  elections: ["elections", "election", "global-elections", "world-elections", "primary", "presidential", "nominee", "midterms"],
  geopolitics: ["geopolitics", "war", "russia", "ukraine", "china", "israel", "gaza", "middle-east", "nato", "ceasefire", "diplomacy"],
  iran: ["iran"],
  economy: ["economy", "inflation", "recession", "gdp", "jobs", "cpi", "unemployment"],
  finance: ["finance", "fed", "rates", "interest-rates", "stocks", "earnings", "markets", "sp500", "nasdaq"],
  crypto: ["crypto", "bitcoin", "ethereum", "solana", "btc", "eth", "memecoin", "defi", "xrp", "doge"],
  tech: ["tech", "ai", "openai", "technology", "nvidia", "apple", "google", "tesla", "spacex", "chatgpt"],
  sports: ["sports", "soccer", "football", "nfl", "nba", "mlb", "nhl", "ufc", "tennis", "fifa", "basketball", "baseball", "boxing", "golf", "f1"],
  esports: ["esports", "dota-2", "dota", "lol", "league-of-legends", "csgo", "cs2", "valorant", "gaming"],
  culture: ["culture", "pop-culture", "entertainment", "movies", "music", "awards", "celebrities", "tv", "oscars", "grammys"],
  weather: ["weather", "temperature", "hurricane", "climate", "heat", "snow"],
  mentions: ["mentions", "says", "tweet", "will-say", "say"],
};

export interface PolyMarket {
  id: string;
  question: string;
  /** Representative outcome label, e.g. "Yes" or "Congo DR". */
  outcome: string;
  /** Probability of that outcome, 0..1. */
  prob: number;
  volume24h: number;
  volumeTotal: number;
  category: PolyCategory | "other";
  tags: string[];
  image?: string;
  url: string;
}

type GammaMarket = { outcomes?: string; outcomePrices?: string; groupItemTitle?: string; active?: boolean; closed?: boolean };
type GammaEvent = {
  id: string; title: string; slug?: string; image?: string;
  volume24hr?: number | string; volume?: number | string;
  tags?: { slug?: string }[]; markets?: GammaMarket[];
};

const num = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? 0)) || 0);

// Most-specific → most-general, so e.g. an Iran/election market lands in
// "iran"/"elections" rather than being swallowed by the broad "politics".
const CATEGORIZE_ORDER: PolyCategory[] = [
  "iran", "esports", "weather", "mentions", "elections", "crypto", "tech",
  "geopolitics", "finance", "economy", "sports", "culture", "politics",
];

function categorize(tags: string[]): PolyCategory | "other" {
  for (const cat of CATEGORIZE_ORDER) {
    if (tags.some((t) => CATEGORY_TAGS[cat].includes(t))) return cat;
  }
  return "other";
}

/** Pick the favorite outcome across an event's markets (highest first-price). */
function topOutcome(ev: GammaEvent): { outcome: string; prob: number } {
  let best = { outcome: "Yes", prob: 0 };
  const markets = (ev.markets ?? []).filter((m) => m.active && !m.closed && m.outcomePrices);
  for (const m of markets) {
    try {
      const prices = JSON.parse(m.outcomePrices!) as string[];
      const outcomes = JSON.parse(m.outcomes ?? '["Yes","No"]') as string[];
      const p = num(prices[0]);
      if (p > best.prob) {
        // For grouped multi-outcome events the candidate name is groupItemTitle.
        best = { outcome: markets.length > 1 ? (m.groupItemTitle || outcomes[0]) : outcomes[0], prob: p };
      }
    } catch { /* skip malformed */ }
  }
  return best;
}

function toMarket(ev: GammaEvent): PolyMarket {
  const tags = (ev.tags ?? []).map((t) => t.slug || "").filter(Boolean);
  const { outcome, prob } = topOutcome(ev);
  return {
    id: ev.id,
    question: ev.title,
    outcome,
    prob,
    volume24h: num(ev.volume24hr),
    volumeTotal: num(ev.volume),
    category: categorize(tags),
    tags,
    image: ev.image,
    url: ev.slug ? `https://polymarket.com/event/${ev.slug}` : "https://polymarket.com",
  };
}

const GAMMA = "https://gamma-api.polymarket.com/events";

/** Fetch the top active markets by 24h volume (CORS-open public API). */
export async function fetchMarkets(): Promise<PolyMarket[]> {
  const url = `${GAMMA}?closed=false&active=true&archived=false&limit=120&order=volume24hr&ascending=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polymarket ${res.status}`);
  const data = (await res.json()) as GammaEvent[];
  return data
    .map(toMarket)
    .filter((m) => m.question && m.prob > 0)
    .sort((a, b) => b.volume24h - a.volume24h);
}

/** Top movers right now: highest share of total volume happening in the last 24h. */
export function breakingFrom(markets: PolyMarket[]): PolyMarket[] {
  return [...markets]
    .filter((m) => m.volumeTotal > 0)
    .sort((a, b) => b.volume24h / b.volumeTotal - a.volume24h / a.volumeTotal)
    .slice(0, 12);
}

/** Compact volume label, e.g. $1.2M / $45k. */
export function fmtVol(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

/** Offline fallback so the panel still demos without network. */
export const MOCK_MARKETS: PolyMarket[] = [
  { id: "m1", question: "Will Bitcoin hit $150k in 2026?", outcome: "Yes", prob: 0.42, volume24h: 4_200_000, volumeTotal: 88_000_000, category: "crypto", tags: ["crypto", "bitcoin"], url: "https://polymarket.com" },
  { id: "m2", question: "US x Iran permanent peace deal in 2026?", outcome: "Yes", prob: 0.18, volume24h: 2_400_000, volumeTotal: 12_000_000, category: "iran", tags: ["iran", "geopolitics"], url: "https://polymarket.com" },
  { id: "m3", question: "2028 Democratic Presidential Nominee", outcome: "Newsom", prob: 0.27, volume24h: 3_500_000, volumeTotal: 40_000_000, category: "elections", tags: ["elections", "politics"], url: "https://polymarket.com" },
  { id: "m4", question: "World Cup 2026 Winner", outcome: "Spain", prob: 0.16, volume24h: 51_000_000, volumeTotal: 220_000_000, category: "sports", tags: ["sports", "soccer"], url: "https://polymarket.com" },
  { id: "m5", question: "Will OpenAI release GPT-6 in 2026?", outcome: "Yes", prob: 0.55, volume24h: 900_000, volumeTotal: 8_000_000, category: "tech", tags: ["tech", "ai"], url: "https://polymarket.com" },
  { id: "m6", question: "Fed cuts rates at next meeting?", outcome: "Yes", prob: 0.63, volume24h: 1_800_000, volumeTotal: 30_000_000, category: "finance", tags: ["finance", "fed"], url: "https://polymarket.com" },
  { id: "m7", question: "Dota 2: Team Falcons vs Team Liquid", outcome: "Falcons", prob: 0.58, volume24h: 2_400_000, volumeTotal: 9_000_000, category: "esports", tags: ["esports", "dota-2"], url: "https://polymarket.com" },
  { id: "m8", question: "Highest-grossing 2026 movie?", outcome: "Avatar 3", prob: 0.38, volume24h: 400_000, volumeTotal: 3_000_000, category: "culture", tags: ["culture", "movies"], url: "https://polymarket.com" },
];
