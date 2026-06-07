import { useEffect, useState } from "react";
import { Globe, Flame, Newspaper, Activity, Briefcase, TrendingUp } from "lucide-react";
import { Sparkline } from "../Sparkline";
import { PolymarketMark } from "../Brand";
import { TradingViewTechnicals } from "./TradingViewTechnicals";
import { compact } from "../../lib/format";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

interface MarketData {
  global: { sym: string; name: string; price: number; chg: number; spark: number[]; cls?: "crypto" | "index" | "commodity" }[];
  narratives: { name: string; chg24h: number; views: number; heat: number }[];
  movers: { sym: string; price: number; chg: number; vol: number }[];
  gauges: { fearGreed: number; fearGreedLabel: string; btcDominance: number; totalMcap: number; altSeason: number };
  polymarket: { q: string; yes: number; vol: number; cat: string; end: string }[];
}

const price = (n: number) => n >= 1000 ? "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

/* demo data for the panels we don't have a live free source for */
const HL_TRADERS = [
  { name: "ansem.eth", pnl: 4.82e6, win: 71, trend: [3, 5, 4, 6, 8, 7, 9] },
  { name: "0xWhale", pnl: 3.11e6, win: 64, trend: [5, 4, 6, 5, 7, 6, 8] },
  { name: "GiganticRebirth", pnl: 2.45e6, win: 68, trend: [2, 4, 3, 5, 4, 6, 7] },
  { name: "Tetra", pnl: 1.9e6, win: 59, trend: [4, 3, 5, 4, 6, 5, 6] },
  { name: "cupsey.sol", pnl: 1.42e6, win: 73, trend: [3, 5, 6, 5, 7, 8, 9] },
  { name: "0xFrank", pnl: 0.98e6, win: 55, trend: [5, 4, 4, 5, 3, 4, 5] },
  { name: "perpgod.eth", pnl: 0.91e6, win: 62, trend: [4, 5, 5, 6, 5, 7, 8] },
  { name: "0xMachi", pnl: 0.84e6, win: 58, trend: [6, 5, 7, 6, 5, 6, 7] },
  { name: "liquidated.eth", pnl: 0.77e6, win: 66, trend: [3, 4, 5, 4, 5, 6, 6] },
  { name: "hsaka.hl", pnl: 0.69e6, win: 70, trend: [2, 3, 4, 5, 6, 7, 8] },
  { name: "0xSisyphus", pnl: 0.58e6, win: 53, trend: [5, 4, 5, 4, 4, 5, 5] },
  { name: "cobie.eth", pnl: 0.51e6, win: 61, trend: [4, 5, 4, 6, 5, 6, 7] },
  { name: "0xNomad", pnl: 0.44e6, win: 57, trend: [3, 4, 4, 5, 5, 5, 6] },
  { name: "degenharry", pnl: 0.38e6, win: 64, trend: [4, 4, 5, 5, 6, 6, 7] },
  { name: "0xPepe", pnl: 0.29e6, win: 51, trend: [5, 4, 4, 4, 5, 4, 5] },
];
const PORTFOLIOS = [
  { fund: "ARK Invest", top: "COIN", value: 1.2e9, chg: 8.4 },
  { fund: "BlackRock 13F", top: "IBIT", value: 4.8e9, chg: 12.1 },
  { fund: "a16z", top: "Solana", value: 2.1e9, chg: -3.2 },
  { fund: "Pantera", top: "BTC", value: 0.9e9, chg: 5.6 },
  { fund: "Galaxy Digital", top: "ETH", value: 1.4e9, chg: -1.8 },
  { fund: "Grayscale", top: "GBTC", value: 3.6e9, chg: 4.2 },
  { fund: "Paradigm", top: "Uniswap", value: 1.8e9, chg: 6.9 },
  { fund: "Multicoin", top: "SOL", value: 1.1e9, chg: 9.1 },
  { fund: "Jump Crypto", top: "BTC", value: 2.4e9, chg: -0.7 },
  { fund: "Polychain", top: "ETH", value: 1.3e9, chg: 3.4 },
  { fund: "Fidelity 13F", top: "FBTC", value: 2.9e9, chg: 5.1 },
  { fund: "VanEck", top: "HODL", value: 0.7e9, chg: 2.3 },
];
const NEWS = [
  { src: "CoinDesk", t: "8m", tone: "bull", title: "Solana DEX volume hits new ATH as memecoin activity surges" },
  { src: "The Block", t: "23m", tone: "bull", title: "BlackRock files for in-kind redemptions on spot BTC ETF" },
  { src: "Decrypt", t: "41m", tone: "bull", title: "AI-agent tokens add $4B in market cap over the past week" },
  { src: "Bloomberg", t: "1h", tone: "bear", title: "Fed minutes signal caution; rate-cut odds slip below 20%" },
  { src: "Reuters", t: "1h", tone: "neutral", title: "Dollar softens as risk appetite returns to global markets" },
];
const toneColor: Record<string, string> = { bull: "text-up", bear: "text-down", neutral: "text-muted" };

function Panel({ title, icon, right, children, className = "" }: { title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`vc-glass flex flex-col rounded-2xl p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="serif text-[16px] font-bold tracking-tight">{title}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </div>
  );
}

function MarketTable({ title, rows }: { title: string; rows: MarketData["global"] }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">{title}</div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[9px] uppercase tracking-wider text-faint">
            <th className="pb-1 text-left font-semibold">Asset</th>
            <th className="pb-1 text-right font-semibold">Price</th>
            <th className="pb-1 text-right font-semibold">24h</th>
            <th className="pb-1 pl-2 text-right font-semibold">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const up = m.chg >= 0;
            return (
              <tr key={m.sym} className="border-t border-white/6">
                <td className="py-1.5 font-bold">{m.sym}</td>
                <td className="py-1.5 text-right font-mono tabular-nums text-muted">{price(m.price)}</td>
                <td className={`py-1.5 text-right font-bold tabular-nums ${up ? "text-up" : "text-down"}`}>{pct(m.chg)}</td>
                <td className="py-1.5 pl-2 text-right"><span className="inline-block"><Sparkline data={m.spark} width={64} height={16} color={up ? "#16e6a4" : "#ff5a6a"} /></span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MarketTabClassic() {
  const [d, setD] = useState<MarketData | null>(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let on = true;
    let timer: ReturnType<typeof setTimeout>;
    let fails = 0;
    const schedule = (ms: number) => { timer = setTimeout(load, ms); };
    const load = () => {
      fetch(`${BACKEND}/api/market`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((j) => { if (!on) return; if (!j || !Array.isArray(j.global)) throw new Error("bad shape"); fails = 0; setD(j); schedule(120_000); })
        .catch(() => { if (!on) return; fails += 1; setTries(fails); schedule(Math.min(1500 * fails, 12_000)); });
    };
    load();
    return () => { on = false; clearTimeout(timer); };
  }, []);
  if (!d) return (
    <div className="mb-tab p-10 text-center text-muted">
      {tries >= 3 ? `Market feed slow to respond — retrying… (attempt ${tries})` : "Loading market data…"}
    </div>
  );

  const crypto = d.global.filter((m) => m.cls === "crypto").slice(0, 10);
  const indices = d.global.filter((m) => m.cls === "index").slice(0, 10);
  const commodities = d.global.filter((m) => m.cls === "commodity").slice(0, 10);
  const topPoly = [...d.polymarket].sort((a, b) => b.vol - a.vol);

  return (
    <div className="mb-tab" data-text="serif">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <h1 className="serif text-3xl font-bold tracking-tight sm:text-4xl">Market</h1>
        <p className="mt-1 text-[13px] text-muted">Classic layout — global markets, narratives, smart money, portfolios &amp; Polymarket in one terminal.</p>

        {/* Global Markets — three tables */}
        <div className="mt-5">
          <Panel title="Global Markets" icon={<Globe size={15} className="text-accent" />}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <MarketTable title="Stock Indices" rows={indices} />
              <MarketTable title="Crypto" rows={crypto} />
              <MarketTable title="Commodities" rows={commodities} />
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Narrative Monitor */}
          <Panel title="Market Narrative Monitor" icon={<Flame size={15} className="text-gold" />} className="lg:col-span-8">
            <div className="space-y-1.5">
              {d.narratives.map((n, i) => (
                <div key={n.name} className="grid grid-cols-[1.4rem_1fr_auto] items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <span className="text-[12px] font-bold tabular-nums text-faint">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold">{n.name}</div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full" style={{ width: `${n.heat}%`, background: "linear-gradient(90deg,var(--vc-accent),#ff4b16)" }} /></div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div className="hidden text-right sm:block"><div className="text-[11px] tabular-nums text-muted">{compact(n.views)}</div><div className="text-[9px] uppercase text-faint">views</div></div>
                    <span className={`w-14 rounded px-1.5 py-0.5 text-right text-[11px] font-bold tabular-nums ${n.chg24h >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>{pct(n.chg24h)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Market Pulse KPIs */}
          <Panel title="Market Pulse" icon={<Activity size={15} className="text-up" />} right={<span className="text-[10px] uppercase tracking-wider text-faint">live</span>} className="lg:col-span-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Fear & Greed", String(d.gauges.fearGreed), d.gauges.fearGreedLabel],
                ["BTC Dominance", d.gauges.btcDominance.toFixed(1) + "%", "of total cap"],
                ["Total Mcap", "$" + compact(d.gauges.totalMcap), "all crypto"],
                ["Alt Season", d.gauges.altSeason + "/100", d.gauges.altSeason > 50 ? "alts leading" : "BTC-led"],
              ].map(([l, v, s]) => (
                <div key={l} className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-faint">{l}</div>
                  <div className="mt-0.5 text-[20px] font-extrabold tabular-nums text-accent">{v}</div>
                  <div className="text-[9px] text-muted">{s}</div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Smart Money — Top Hyperliquid Traders */}
          <Panel title="Top Hyperliquid Traders" icon={<TrendingUp size={15} className="text-up" />} right={<span className="text-[10px] uppercase tracking-wider text-faint">demo</span>} className="lg:col-span-5">
            <table className="w-full text-[12px]">
              <thead><tr className="text-[9px] uppercase tracking-wider text-faint"><th className="pb-1 text-left">#</th><th className="pb-1 text-left">Trader</th><th className="pb-1 text-right">PNL 30D</th><th className="pb-1 text-right">Win</th><th className="pb-1 pl-2 text-right">Trend</th></tr></thead>
              <tbody>
                {HL_TRADERS.map((t, i) => (
                  <tr key={t.name} className="border-t border-white/6">
                    <td className="py-1.5 font-bold text-faint">{i + 1}</td>
                    <td className="py-1.5 font-semibold">{t.name}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-up">+${compact(t.pnl)}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted">{t.win}%</td>
                    <td className="py-1.5 pl-2 text-right"><span className="inline-block"><Sparkline data={t.trend} width={56} height={16} color="#16e6a4" /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Influential Portfolios (13F) */}
          <Panel title="Influential Portfolios" icon={<Briefcase size={15} className="text-accent" />} right={<span className="text-[10px] uppercase tracking-wider text-faint">13F · demo</span>} className="lg:col-span-4">
            <div className="space-y-1.5">
              {PORTFOLIOS.map((p) => (
                <div key={p.fund} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2">
                  <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold">{p.fund}</div><div className="text-[10px] text-faint">top: {p.top}</div></div>
                  <div className="text-right"><div className="text-[12px] font-bold tabular-nums">${compact(p.value)}</div><div className={`text-[10px] font-bold ${p.chg >= 0 ? "text-up" : "text-down"}`}>{pct(p.chg)}</div></div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Top Polymarket Volume */}
          <Panel title="Top Polymarket Volume" icon={<PolymarketMark className="h-4 w-5 text-accent" />} className="lg:col-span-3">
            <div className="space-y-2">
              {topPoly.slice(0, 5).map((m) => (
                <div key={m.q} className="rounded-lg border border-white/8 bg-white/[0.02] p-2">
                  <div className="line-clamp-2 text-[11.5px] font-semibold leading-snug">{m.q}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-down/30"><div className="h-full rounded-full bg-up" style={{ width: `${m.yes}%` }} /></div>
                  <div className="mt-1 flex items-center justify-between text-[10px] font-bold"><span className="text-up">Yes {m.yes}%</span><span className="text-down">No {100 - m.yes}%</span></div>
                  <div className="mt-0.5 text-[9px] text-faint">${compact(m.vol)} vol</div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Intelligence Feed (news) */}
          <Panel title="Intelligence Feed" icon={<Newspaper size={15} className="text-accent" />} className="lg:col-span-12">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {NEWS.map((n, i) => (
                <div key={i} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                  <div className="mb-1 flex items-center gap-2 text-[10px] text-faint"><span className="font-bold text-muted">{n.src}</span><span>· {n.t}</span><span className={`ml-auto rounded px-1 font-bold uppercase ${toneColor[n.tone]}`}>{n.tone}</span></div>
                  <div className="text-[12.5px] font-medium leading-snug">{n.title}</div>
                </div>
              ))}
            </div>
          </Panel>

          {/* TradingView technicals */}
          <div className="lg:col-span-12"><TradingViewTechnicals /></div>
        </div>

        <p className="mt-5 text-center text-[11px] text-faint">Classic reference layout · <span className="font-bold text-up">● Live</span> markets (CoinGecko · Yahoo · alternative.me · Polymarket). Hyperliquid traders &amp; 13F portfolios are demo.</p>
      </div>
    </div>
  );
}
