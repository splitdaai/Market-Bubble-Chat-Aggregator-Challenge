import { useEffect, useState } from "react";
import { Globe, Newspaper, Briefcase, TrendingUp, X as XIcon } from "lucide-react";
import { Sparkline } from "../Sparkline";
import { PageGrid } from "../PageGrid";
import { useLayoutStore } from "../../store/layoutStore";
import { useViewStore } from "../../store/viewStore";
import { PolymarketMark } from "../Brand";
import { TradingViewTechnicals, MiniChart, TechWidget, tvSymbolFor } from "./TradingViewTechnicals";
import { PortfolioModal, PolyTraderModal } from "./Dashboards";
import { HlWalletModal } from "../kol/KolTab";
import { WatchStar } from "../WatchStar";
import { IntelFeed } from "./IntelFeed";
import { compact } from "../../lib/format";

interface HlRow { name: string; addr?: string; pnl: number; roi?: number; value?: number; trend?: number[] }
interface LinkedRow { name: string; xHandle: string; addr: string; chain: "hl" | "evm"; value: number; pnl: number; top?: string }
interface PolyRow { name: string; addr?: string; pnl: number }

type Detail =
  | { kind: "asset"; label: string }
  | { kind: "hltrader"; t: { name: string; addr: string; pnl: number; roi?: number; value: number } }
  | { kind: "polytrader"; t: { name: string; addr?: string; pnl: number; win: number; trend: number[] } }
  | { kind: "portfolio"; p: { fund: string; top: string; value: number; chg: number } };

function AssetModal({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mb-tab mt-10 w-full max-w-3xl rounded-2xl border border-white/10 bg-[#121212]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/8 p-4">
          <div className="serif text-xl font-bold">{label}<span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-faint">technicals</span></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><XIcon size={18} /></button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-white/8 bg-black/20"><MiniChart symbol={tvSymbolFor(label)} /></div>
          <div className="overflow-hidden rounded-xl border border-white/8 bg-black/20"><TechWidget symbol={tvSymbolFor(label)} /></div>
        </div>
      </div>
    </div>
  );
}

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

/* 13F-style portfolios — no free real-time API for these specific funds (curated). */
const LEADERBOARD_LIMIT = 20;
const leaderboardShell = "grid min-h-0 flex-1 grid-rows-[auto_1fr] text-[12px] leading-none";
const leaderboardHead = "grid items-center pb-1 text-[9px] uppercase tracking-wider text-faint";
const leaderboardBody = "grid min-h-0";
const leaderboardRow = "grid min-h-0 cursor-pointer items-center border-t border-white/6 text-left transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70";
const leaderboardRowsStyle = { gridTemplateRows: `repeat(${LEADERBOARD_LIMIT}, minmax(0, 1fr))` };
const onRowKey = (event: React.KeyboardEvent<HTMLDivElement>, action: () => void) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
};

function Panel({ title, icon, right, children, className = "" }: { title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`vc-glass flex h-full flex-col overflow-hidden rounded-2xl p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="serif text-[16px] font-bold tracking-tight">{title}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </div>
  );
}

function MarketTable({ title, rows, onPick }: { title: string; rows: MarketData["global"]; onPick?: (sym: string) => void }) {
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
              <tr key={m.sym} onClick={() => onPick?.(m.sym)} className="cursor-pointer border-t border-white/6 transition hover:bg-white/5">
                <td className="py-1.5 font-bold"><span className="inline-flex items-center gap-1">{m.sym}<WatchStar item={{ key: `asset:${m.sym}`, type: "asset", label: m.sym }} size={11} /></span></td>
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
  const [detail, setDetail] = useState<Detail | null>(null);
  const [lb, setLb] = useState<{ hyperliquid: HlRow[]; polymarket: PolyRow[]; linked?: LinkedRow[] } | null>(null);
  const [vaults, setVaults] = useState<{ name: string; addr: string; tvl: number; apr: number }[] | null>(null);
  const setView = useViewStore((s) => s.setView);
  const editMode = useLayoutStore((s) => s.editMode);
  useEffect(() => {
    let on = true;
    const load = () => {
      fetch(`${BACKEND}/api/leaderboards?t=${Math.floor(Date.now() / 300000)}`).then((r) => r.json()).then((j) => { if (on && Array.isArray(j.hyperliquid)) setLb(j); }).catch(() => {});
      fetch(`${BACKEND}/api/vaults`).then((r) => r.json()).then((v) => { if (on && Array.isArray(v) && v.length) setVaults(v); }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 600_000);
    return () => { on = false; clearInterval(iv); };
  }, []);
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

  return (
    <div className="mb-tab" data-text="serif">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <h1 className="serif text-3xl font-bold tracking-tight sm:text-4xl">Market</h1>
        <p className="mt-1 text-[13px] text-muted">Classic layout — global markets, narratives, smart money, portfolios &amp; Polymarket in one terminal.</p>

        <PageGrid
          pageKey="market-classic-v4"
          editMode={editMode}
          titles={{ global: "Global Markets", tech: "Technicals", hl: "Top Hyperliquid Traders", portfolios: "Influential Portfolios", poly: "Top Polymarket Traders", intel: "Intelligence Feed" }}
          items={[
            { id: "global", x: 0, y: 0, w: 12, h: 8, node: (
              <Panel title="Global Markets" icon={<Globe size={15} className="text-accent" />}>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <MarketTable title="Stock Indices" rows={indices} onPick={(sym) => setDetail({ kind: "asset", label: sym })} />
                  <MarketTable title="Crypto" rows={crypto} onPick={(sym) => setDetail({ kind: "asset", label: sym })} />
                  <MarketTable title="Commodities" rows={commodities} onPick={(sym) => setDetail({ kind: "asset", label: sym })} />
                </div>
              </Panel>
            ) },
            { id: "tech", x: 0, y: 8, w: 12, h: 11, node: <TradingViewTechnicals /> },
            { id: "hl", x: 0, y: 19, w: 4, h: 13, node: (
              <Panel title="Top Hyperliquid Traders" icon={<TrendingUp size={15} className="text-up" />} right={<span className="text-[10px] uppercase tracking-wider text-up">● live</span>}>
                <div className={leaderboardShell}>
                  <div className={`${leaderboardHead} grid-cols-[2rem_minmax(0,1fr)_4.7rem_3rem_4.3rem]`}>
                    <span>#</span><span>Trader</span><span className="text-right">PNL 30D</span><span className="text-right">ROI</span><span className="pl-2 text-right">Trend</span>
                  </div>
                  <div className={leaderboardBody} style={leaderboardRowsStyle}>
                    {(lb?.hyperliquid ?? []).slice(0, LEADERBOARD_LIMIT).map((t, i) => {
                      const open = () => { if (!t.addr) return; setDetail({ kind: "hltrader", t: { name: t.name, addr: t.addr, pnl: t.pnl, roi: t.roi, value: t.value ?? 0 } }); };
                      return (
                      <div key={t.addr ?? t.name} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => onRowKey(e, open)} className={`${leaderboardRow} grid-cols-[2rem_minmax(0,1fr)_4.7rem_3rem_4.3rem]`}>
                        <span className="font-bold text-faint">{i + 1}</span>
                        <span className="min-w-0 font-semibold"><span className="inline-flex min-w-0 items-center gap-1"><span className="truncate">{t.name}</span><WatchStar item={{ key: `trader:${t.name}`, type: "trader", label: t.name, sub: "HL" }} size={11} /></span></span>
                        <span className={`text-right font-bold tabular-nums ${t.pnl >= 0 ? "text-up" : "text-down"}`}>{t.pnl >= 0 ? "+" : "-"}${compact(Math.abs(t.pnl))}</span>
                        <span className={`text-right tabular-nums ${(t.roi ?? 0) >= 0 ? "text-up" : "text-down"}`}>{(t.roi ?? 0) >= 0 ? "+" : ""}{(t.roi ?? 0).toFixed(1)}%</span>
                        <span className="pl-2 text-right"><Sparkline data={t.trend ?? []} width={52} height={14} color={(t.roi ?? 0) >= 0 ? "#16e6a4" : "#ff5a6a"} /></span>
                      </div>
                    ); })}
                    {!lb && <div className="py-6 text-center text-[11px] text-faint">Loading live Hyperliquid leaderboard…</div>}
                  </div>
                </div>
              </Panel>
            ) },
            { id: "portfolios", x: 4, y: 19, w: 4, h: 13, node: (
              <Panel title="Top Hyperliquid Vaults" icon={<Briefcase size={15} className="text-accent" />} right={<span className="text-[10px] uppercase tracking-wider text-up">● live · TVL</span>}>
                <div className={leaderboardShell}>
                  <div className={`${leaderboardHead} grid-cols-[2rem_minmax(0,1fr)_5rem_4rem]`}>
                    <span>#</span><span>Vault</span><span className="text-right">TVL</span><span className="text-right">APR</span>
                  </div>
                  <div className={leaderboardBody} style={leaderboardRowsStyle}>
                    {(vaults ?? []).slice(0, LEADERBOARD_LIMIT).map((v, i) => {
                      const open = () => window.open(`https://app.hyperliquid.xyz/vaults/${v.addr}`, "_blank", "noopener");
                      return (
                        <div key={v.addr} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => onRowKey(e, open)} className={`${leaderboardRow} grid-cols-[2rem_minmax(0,1fr)_5rem_4rem]`}>
                          <span className="font-bold text-faint">{i + 1}</span>
                          <span className="min-w-0 font-semibold"><span className="inline-flex min-w-0 items-center gap-1"><span className="truncate">{v.name}</span><WatchStar item={{ key: `vault:${v.addr}`, type: "portfolio", label: v.name }} size={11} /></span></span>
                          <span className="text-right font-bold tabular-nums">${compact(v.tvl)}</span>
                          <span className={`text-right font-bold tabular-nums ${v.apr >= 0 ? "text-up" : "text-down"}`}>{pct(v.apr)}</span>
                        </div>
                      );
                    })}
                    {!vaults && <div className="py-6 text-center text-[11px] text-faint">Loading live Hyperliquid vaults…</div>}
                  </div>
                </div>
              </Panel>
            ) },
            { id: "poly", x: 8, y: 19, w: 4, h: 13, node: (
              <Panel title="Top Polymarket Traders" icon={<PolymarketMark className="h-4 w-5 text-accent" />} right={<span className="text-[10px] uppercase tracking-wider text-up">● live · 30d</span>}>
                <div className={leaderboardShell}>
                  <div className={`${leaderboardHead} grid-cols-[2rem_minmax(0,1fr)_5rem]`}>
                    <span>#</span><span>Trader</span><span className="text-right">PNL 30D</span>
                  </div>
                  <div className={leaderboardBody} style={leaderboardRowsStyle}>
                    {(lb?.polymarket ?? []).slice(0, LEADERBOARD_LIMIT).map((t, i) => {
                      const open = () => setDetail({ kind: "polytrader", t: { name: t.name, addr: t.addr, pnl: t.pnl, win: 0, trend: [] } });
                      return (
                      <div key={t.addr ?? t.name} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => onRowKey(e, open)} className={`${leaderboardRow} grid-cols-[2rem_minmax(0,1fr)_5rem]`}>
                        <span className="font-bold text-faint">{i + 1}</span>
                        <span className="min-w-0 font-semibold"><span className="inline-flex min-w-0 items-center gap-1"><span className="truncate">{t.name}</span><WatchStar item={{ key: `polytrader:${t.name}`, type: "polytrader", label: t.name, sub: "Poly" }} size={11} /></span></span>
                        <span className={`text-right font-bold tabular-nums ${t.pnl >= 0 ? "text-up" : "text-down"}`}>{t.pnl >= 0 ? "+" : "-"}${compact(Math.abs(t.pnl))}</span>
                      </div>
                    ); })}
                    {!lb && <div className="py-6 text-center text-[11px] text-faint">Loading live Polymarket leaderboard…</div>}
                  </div>
                </div>
              </Panel>
            ) },
            { id: "intel", x: 0, y: 32, w: 12, h: 8, node: (
              <Panel title="Intelligence Feed" icon={<Newspaper size={15} className="text-accent" />} right={<span className="text-[10px] uppercase tracking-wider text-up">● live · AI-scored</span>}>
                <IntelFeed />
              </Panel>
            ) },
          ]}
        />

        <p className="mt-5 text-center text-[11px] text-faint">Classic reference layout · <span className="font-bold text-up">● Live</span> markets (CoinGecko · Yahoo · alternative.me · Polymarket). Hyperliquid traders, vaults &amp; headlines are live.</p>
      </div>
      {detail?.kind === "asset" && <AssetModal label={detail.label} onClose={() => setDetail(null)} />}
      {detail?.kind === "hltrader" && <HlWalletModal trader={detail.t} onClose={() => setDetail(null)} />}
      {detail?.kind === "polytrader" && <PolyTraderModal trader={detail.t} color="#34d6ff" onClose={() => setDetail(null)} />}
      {detail?.kind === "portfolio" && <PortfolioModal portfolio={detail.p} color="#00d872" onClose={() => setDetail(null)} />}
    </div>
  );
}
