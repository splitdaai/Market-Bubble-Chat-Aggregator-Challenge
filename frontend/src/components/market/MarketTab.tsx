import { useEffect, useState } from "react";
import { Flame, Globe, TrendingUp, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Sparkline } from "../Sparkline";
import { compact } from "../../lib/format";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

interface MarketData {
  global: { sym: string; name: string; price: number; chg: number; spark: number[] }[];
  narratives: { name: string; chg24h: number; views: number; heat: number }[];
  movers: { sym: string; price: number; chg: number; vol: number }[];
  gauges: { fearGreed: number; fearGreedLabel: string; btcDominance: number; totalMcap: number; altSeason: number };
  polymarket: { q: string; yes: number; vol: number; cat: string; end: string }[];
}

const price = (n: number) => n >= 1000 ? "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

function Panel({ title, icon, right, children }: { title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="vc-glass flex flex-col rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{title}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </div>
  );
}
const Tag = ({ v }: { v: number }) => (
  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${v >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>{v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(2)}%</span>
);
const chip = "rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted";

export function MarketTab() {
  const [d, setD] = useState<MarketData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let on = true;
    const load = () => fetch(`${BACKEND}/api/market`).then((r) => r.json()).then((j) => on && setD(j)).catch(() => on && setErr(true));
    load();
    const t = setInterval(load, 120_000);
    return () => { on = false; clearInterval(t); };
  }, []);

  if (err) return <div className="p-10 text-center text-muted">Market feed unavailable. Retrying…</div>;
  if (!d) return <div className="p-10 text-center text-muted">Loading live market data…</div>;

  const g = d.gauges;
  const gainers = d.movers.filter((m) => m.chg >= 0).sort((a, b) => b.chg - a.chg);
  const losers = d.movers.filter((m) => m.chg < 0).sort((a, b) => a.chg - b.chg);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Market Intelligence</h1>
      <p className="mt-1 text-[13px] text-muted">Narrative monitor · global markets · movers · Polymarket — live, every ~5 min.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Narrative Monitor */}
        <div className="lg:col-span-8">
          <Panel title="Narrative Monitor" icon={<Flame size={14} className="text-gold" />} right={<span className={chip}>24h · by views</span>}>
            <div className="space-y-1.5">
              {d.narratives.map((n, i) => (
                <div key={n.name} className="grid grid-cols-[1.4rem_1fr_auto] items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <span className="text-[12px] font-bold tabular-nums text-faint">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-bold">{n.name}</div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full" style={{ width: `${n.heat}%`, background: "linear-gradient(90deg,var(--vc-accent),#ff4b16)" }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden text-right sm:block">
                      <div className="text-[11px] tabular-nums text-muted">{compact(n.views)}</div>
                      <div className="text-[9px] uppercase tracking-wider text-faint">views</div>
                    </div>
                    <div className="w-16"><Tag v={n.chg24h} /></div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Global Markets */}
        <div className="lg:col-span-4">
          <Panel title="Global Markets" icon={<Globe size={14} className="text-accent" />}>
            <div className="grid grid-cols-2 gap-2">
              {d.global.map((m) => {
                const up = m.chg >= 0;
                return (
                  <div key={m.sym} className="rounded-lg border border-white/8 p-2.5" style={{ background: `color-mix(in srgb, ${up ? "var(--vc-accent)" : "#ff5a6a"} 8%, transparent)` }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] font-bold">{m.sym}</span>
                      <span className={`text-[11px] font-bold tabular-nums ${up ? "text-up" : "text-down"}`}>{pct(m.chg)}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] tabular-nums text-muted">{price(m.price)}</div>
                    <div className="mt-1"><Sparkline data={m.spark} width={120} height={20} color={up ? "#16e6a4" : "#ff5a6a"} /></div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Polymarket */}
        <div className="lg:col-span-5">
          <Panel title="Polymarket" icon={<TrendingUp size={14} className="text-accent" />} right={<span className={chip}>trending</span>}>
            <div className="space-y-2">
              {d.polymarket.map((m) => (
                <div key={m.q} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                  <div className="text-[13px] font-semibold leading-snug">{m.q}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-down/25"><div className="h-full rounded-full bg-up" style={{ width: `${m.yes}%` }} /></div>
                    <span className="w-20 text-right font-mono text-[11px] tabular-nums"><span className="text-up">{m.yes}%</span> <span className="text-faint">yes</span></span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-faint">
                    <span className={chip}>{m.cat}</span>
                    <span>${compact(m.vol)} vol</span>
                    <span className="ml-auto">ends {m.end}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Market Tracker: gauges + gainers/losers */}
        <div className="lg:col-span-7">
          <Panel title="Market Tracker" icon={<Activity size={14} className="text-up" />} right={<span className={chip}>movers · sentiment</span>}>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Fear & Greed", String(g.fearGreed), g.fearGreedLabel],
                ["BTC Dominance", g.btcDominance.toFixed(1) + "%", "of total cap"],
                ["Total Mcap", "$" + compact(g.totalMcap), "all crypto"],
                ["Alt Season", g.altSeason + "/100", g.altSeason > 50 ? "alts leading" : "BTC-led"],
              ].map(([l, v, s]) => (
                <div key={l} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-faint">{l}</div>
                  <div className="text-[18px] font-extrabold tabular-nums text-accent">{v}</div>
                  <div className="text-[9px] text-muted">{s}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[["Top Gainers", gainers, ArrowUpRight, "text-up"], ["Top Losers", losers, ArrowDownRight, "text-down"]].map(([title, list, Icon, tone]) => {
                const I = Icon as typeof ArrowUpRight;
                return (
                  <div key={title as string}>
                    <div className={`mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}><I size={12} /> {title as string}</div>
                    <div className="space-y-1">
                      {(list as MarketData["movers"]).map((m) => (
                        <div key={m.sym} className="flex items-center gap-2 rounded-md border border-white/6 bg-white/[0.02] px-2 py-1 text-[12px]">
                          <span className="font-bold">{m.sym}</span>
                          <span className="font-mono text-faint">{price(m.price)}</span>
                          <span className="ml-auto font-mono text-faint">${compact(m.vol)}</span>
                          <span className={`w-14 text-right font-bold tabular-nums ${m.chg >= 0 ? "text-up" : "text-down"}`}>{pct(m.chg)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] text-faint">
        <span className="font-bold text-up">● Live</span> via CoinGecko · Yahoo Finance · alternative.me · Polymarket (proxied through the Market Bubble backend). Narrative names + 24h Δ are real; per-narrative view counts are estimated.
      </p>
    </div>
  );
}
