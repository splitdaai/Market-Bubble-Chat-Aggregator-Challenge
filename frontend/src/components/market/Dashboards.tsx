import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X as XIcon, ArrowUpRight, ArrowDownRight, Activity, TrendingUp, Wallet, UserPlus, Trophy, Search, ExternalLink } from "lucide-react";
import { RangeChart } from "../RangeChart";
import { compact } from "../../lib/format";

const usd = (n: number) => (n < 0 ? "-$" : "$") + compact(Math.abs(n));

/** Best-effort X handle for a trader name (known KOLs mapped; else cleaned name). */
const X_HANDLES: Record<string, string> = {
  "ansem.eth": "blknoiz06", "cobie.eth": "cobie", "GiganticRebirth": "GCRClassic", "hsaka.hl": "HsakaTrades",
  "cupsey.sol": "cupseyy", "0xWhale": "0xWh4le", "perpgod.eth": "perpdex", "0xMachi": "machibigbrother",
};
function xHandleFor(name: string): string { return X_HANDLES[name] ?? name.replace(/\.(eth|sol|hl)$/i, "").replace(/[^A-Za-z0-9_]/g, ""); }
const follow = (name: string) => window.open(`https://x.com/intent/follow?screen_name=${xHandleFor(name)}`, "_blank");
const TOKENS = ["BTC", "ETH", "SOL", "WIF", "BONK", "JUP", "POPCAT", "PNUT", "ONDO", "HYPE", "PEPE", "TON", "INJ", "ARB", "SUI", "GOAT", "VIRTUAL"];
const MARKETS = [
  "Will BTC close above $100k this month?", "Fed cuts rates in the next meeting?", "ETH ETF net inflow positive this week?",
  "Will SOL flip BNB by market cap?", "US election turnout record high?", "Will a spot SOL ETF be approved this year?",
  "Trump to announce crypto reserve?", "Nvidia beats earnings next quarter?", "Will unemployment tick up next print?",
  "Bitcoin dominance above 60% by EOY?", "Will OpenAI valuation top $600B?", "Champions League winner decided?",
];

/** deterministic per-name RNG so a trader's stats are stable across opens. */
function makeRng(seed: string) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff; return h / 0x7fffffff; };
}
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];

function ModalShell({ title, tag, color, onClose, children, href, hrefLabel }: { title: string; tag: string; color: string; onClose: () => void; children: React.ReactNode; href?: string; hrefLabel?: string }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="mb-tab mt-8 w-full max-w-4xl rounded-2xl border border-white/10 bg-[#111]" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/8 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-full text-[16px] font-black text-black" style={{ background: color }}>{title[0]}</span>
          <div className="min-w-0 flex-1">
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className="serif inline-flex items-center gap-1.5 text-xl font-bold hover:text-accent hover:underline">{title} <ExternalLink size={14} /></a>
            ) : (
              <div className="serif text-xl font-bold">{title}</div>
            )}
            <div className="text-[11px] uppercase tracking-wider text-faint">{tag}</div>
          </div>
          {href && <a href={href} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-[12px] font-bold text-ink hover:border-accent/50 hover:text-accent sm:flex">{hrefLabel} <ExternalLink size={12} /></a>}
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><XIcon size={18} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "accent" }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`mt-0.5 text-[17px] font-extrabold tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "accent" ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

const CoolBtn = ({ children, onClick, primary }: { children: React.ReactNode; onClick?: () => void; primary?: boolean }) => (
  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onClick}
    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-bold transition ${primary ? "bg-accent text-black shadow-neon" : "border border-white/15 bg-white/[0.04] text-ink hover:border-white/30"}`}>
    {children}
  </motion.button>
);

/* ---------------- Hyperliquid trader account dashboard ---------------- */
export function HlTraderModal({ trader, color, onClose }: { trader: { name: string; pnl: number; win: number; trend: number[] }; color: string; onClose: () => void }) {
  const [tab, setTab] = useState<"positions" | "trades">("positions");
  const [feed, setFeed] = useState<{ id: number; sym: string; side: "buy" | "sell"; usd: number; pnl: number; ts: number }[]>([]);
  const idRef = useRef(1);

  const data = useMemo(() => {
    const r = makeRng(trader.name);
    const total = 40 + Math.floor(r() * 90);
    const wins = Math.round((total * trader.win) / 100);
    const losses = total - wins;
    const equity = Array.from({ length: 32 }, (_, i) => 50 + i * (trader.pnl / 1e6) * 1.5 + Math.sin(i / 3) * 8 + r() * 14);
    const positions = Array.from({ length: 5 }, () => {
      const long = r() > 0.4; const sz = Math.round((20000 + r() * 800000) / 1000) * 1000; const pnlPct = +(r() * 40 - (long ? 12 : 16)).toFixed(1);
      return { sym: pick(r, TOKENS), long, sz, lev: 2 + Math.floor(r() * 18), pnlPct, pnlUsd: Math.round(sz * pnlPct / 100) };
    });
    const history = Array.from({ length: 12 }, (_, i) => {
      const win = r() < trader.win / 100; const usdv = Math.round((5000 + r() * 400000) / 1000) * 1000;
      return { sym: pick(r, TOKENS), side: (r() > 0.5 ? "buy" : "sell") as "buy" | "sell", usd: usdv, pnl: Math.round(usdv * (win ? 0.05 + r() * 0.4 : -(0.03 + r() * 0.25))), min: (i + 1) * (3 + Math.floor(r() * 30)) };
    });
    const avgWin = Math.round(history.filter((h) => h.pnl > 0).reduce((s, h) => s + h.pnl, 0) / Math.max(1, history.filter((h) => h.pnl > 0).length));
    const avgLoss = Math.round(history.filter((h) => h.pnl < 0).reduce((s, h) => s + h.pnl, 0) / Math.max(1, history.filter((h) => h.pnl < 0).length));
    return { total, wins, losses, equity, positions, history, avgWin, avgLoss };
  }, [trader]);

  useEffect(() => {
    const r = makeRng(trader.name + "live");
    const tick = () => {
      const win = r() < trader.win / 100; const amount = Math.round((5000 + r() * 300000) / 1000) * 1000;
      setFeed((f) => [{ id: idRef.current++, sym: pick(r, TOKENS), side: (r() > 0.5 ? "buy" : "sell") as "buy" | "sell", usd: amount, pnl: Math.round(amount * (win ? 0.04 + r() * 0.3 : -(0.02 + r() * 0.2))), ts: Date.now() }, ...f].slice(0, 25));
    };
    tick(); const iv = setInterval(tick, 2400);
    return () => clearInterval(iv);
  }, [trader.name, trader.win]);

  const winPct = Math.round((data.wins / data.total) * 100);

  return (
    <ModalShell title={trader.name} tag="Hyperliquid trader · account dashboard" color={color} onClose={onClose} href={`https://app.hyperliquid.xyz/explorer/address/${encodeURIComponent(trader.name)}`} hrefLabel="View on Hyperliquid">
      <div className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <CoolBtn primary onClick={() => follow(trader.name)}><UserPlus size={13} /> Follow on X</CoolBtn>
          <CoolBtn onClick={() => window.open(`https://app.hyperliquid.xyz/explorer/address/${encodeURIComponent(trader.name)}`, "_blank")}><Wallet size={13} /> View on Hyperliquid</CoolBtn>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat label="30D PnL" value={"+" + usd(trader.pnl)} tone="up" />
          <Stat label="Win rate" value={winPct + "%"} tone="accent" />
          <Stat label="Trades" value={String(data.total)} />
          <Stat label="Wins" value={String(data.wins)} tone="up" />
          <Stat label="Losses" value={String(data.losses)} tone="down" />
          <Stat label="Avg win" value={usd(data.avgWin)} tone="up" />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr]">
          {/* equity curve with range filter */}
          <RangeChart seed={trader.name} label="Equity curve" icon={<TrendingUp size={12} />} width={560} height={150} bias={trader.win / 62} />
          {/* win/loss */}
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Win / loss</div>
            <div className="flex h-4 overflow-hidden rounded-full">
              <div className="bg-up" style={{ width: `${winPct}%` }} />
              <div className="bg-down" style={{ width: `${100 - winPct}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] font-bold"><span className="text-up">{data.wins}W</span><span className="text-down">{data.losses}L</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="Avg win" value={usd(data.avgWin)} tone="up" />
              <Stat label="Avg loss" value={usd(data.avgLoss)} tone="down" />
            </div>
            <div className="mt-2 text-center text-[10px] text-muted">Profit factor <span className="font-bold text-accent">{(Math.abs(data.avgWin * data.wins) / Math.max(1, Math.abs(data.avgLoss * data.losses))).toFixed(2)}</span></div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* positions / trades tabs */}
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <div className="mb-2 flex gap-1">
              {(["positions", "trades"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition ${tab === t ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"}`}>{t}</button>
              ))}
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {tab === "positions" ? data.positions.map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[11.5px]">
                  <span className={`font-bold ${p.long ? "text-up" : "text-down"}`}>{p.long ? "LONG" : "SHORT"}</span>
                  <span className="font-mono font-bold text-accent">${p.sym}</span>
                  <span className="text-faint">{p.lev}x</span>
                  <span className="ml-auto tabular-nums text-muted">{usd(p.sz)}</span>
                  <span className={`w-16 text-right font-bold tabular-nums ${p.pnlUsd >= 0 ? "text-up" : "text-down"}`}>{p.pnlUsd >= 0 ? "+" : ""}{usd(p.pnlUsd)}</span>
                </div>
              )) : data.history.map((h, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[11.5px]">
                  <span className={`font-bold ${h.side === "buy" ? "text-up" : "text-down"}`}>{h.side.toUpperCase()}</span>
                  <span className="font-mono font-bold text-accent">${h.sym}</span>
                  <span className="ml-auto tabular-nums text-muted">{usd(h.usd)}</span>
                  <span className={`w-16 text-right font-bold tabular-nums ${h.pnl >= 0 ? "text-up" : "text-down"}`}>{h.pnl >= 0 ? "+" : ""}{usd(h.pnl)}</span>
                  <span className="w-10 text-right text-[9px] text-faint">{h.min}m</span>
                </div>
              ))}
            </div>
          </div>
          {/* live feed */}
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-faint"><Activity size={12} className="text-up" /> Live transactions <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-up" /></div>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {feed.map((t) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[11.5px]">
                    <span className={`flex items-center ${t.side === "buy" ? "text-up" : "text-down"}`}>{t.side === "buy" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}</span>
                    <span className="font-mono font-bold text-accent">${t.sym}</span>
                    <span className="ml-auto tabular-nums text-muted">{usd(t.usd)}</span>
                    <span className={`w-16 text-right font-bold tabular-nums ${t.pnl >= 0 ? "text-up" : "text-down"}`}>{t.pnl >= 0 ? "+" : ""}{usd(t.pnl)}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- Influential portfolio holdings (filterable) ---------------- */
export function PortfolioModal({ portfolio, color, onClose }: { portfolio: { fund: string; top: string; value: number; chg: number }; color: string; onClose: () => void }) {
  const [cls, setCls] = useState<"all" | "crypto" | "equity" | "etf">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"value" | "chg">("value");

  const holdings = useMemo(() => {
    const r = makeRng(portfolio.fund);
    const CRYPTO = ["BTC", "ETH", "SOL", "LINK", "ONDO", "AVAX", "UNI", "AAVE"];
    const EQUITY = ["NVDA", "TSLA", "COIN", "MSTR", "HOOD", "AAPL", "MSFT", "META"];
    const ETF = ["IBIT", "FBTC", "GBTC", "ETHA", "ARKB", "BITB"];
    const rows: { sym: string; cls: "crypto" | "equity" | "etf"; weight: number; chg: number }[] = [];
    const add = (arr: string[], c: "crypto" | "equity" | "etf", n: number) => { const used = new Set<string>(); for (let i = 0; i < n; i++) { let s = pick(r, arr); let g = 0; while (used.has(s) && g++ < 8) s = pick(r, arr); used.add(s); rows.push({ sym: s, cls: c, weight: r() * 100, chg: +(r() * 24 - 10).toFixed(1) }); } };
    add(CRYPTO, "crypto", 5); add(EQUITY, "equity", 5); add(ETF, "etf", 3);
    rows.unshift({ sym: portfolio.top, cls: /BTC|ETH|SOL/.test(portfolio.top) ? "crypto" : /IBIT|FBTC|GBTC|HODL/.test(portfolio.top) ? "etf" : "equity", weight: 30 + r() * 20, chg: portfolio.chg });
    const tot = rows.reduce((s, x) => s + x.weight, 0);
    return rows.map((x) => ({ ...x, weight: +(x.weight / tot * 100).toFixed(1), value: (x.weight / tot) * portfolio.value }));
  }, [portfolio]);

  const view = holdings
    .filter((h) => (cls === "all" || h.cls === cls) && h.sym.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "value" ? b.value - a.value : b.chg - a.chg);

  return (
    <ModalShell title={portfolio.fund} tag="13F portfolio · holdings" color={color} onClose={onClose}>
      <div className="grid grid-cols-3 gap-px border-b border-white/8 bg-white/8 text-center">
        {[["AUM", usd(portfolio.value)], ["24h", (portfolio.chg >= 0 ? "+" : "") + portfolio.chg + "%"], ["Holdings", String(holdings.length)]].map(([l, v]) => (
          <div key={l} className="bg-[#111] py-3"><div className="text-[9px] uppercase tracking-wider text-faint">{l}</div><div className={`mt-0.5 text-[15px] font-bold tabular-nums ${l === "24h" ? (portfolio.chg >= 0 ? "text-up" : "text-down") : ""}`}>{v}</div></div>
        ))}
      </div>
      <div className="p-4">
        {/* filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {(["all", "crypto", "equity", "etf"] as const).map((c) => (
              <button key={c} onClick={() => setCls(c)} className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase transition ${cls === c ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"}`}>{c}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1"><Search size={12} className="text-faint" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter asset…" className="w-28 bg-transparent text-[11px] outline-none placeholder:text-faint" /></div>
            <button onClick={() => setSort(sort === "value" ? "chg" : "value")} className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-bold text-muted hover:text-ink">Sort: {sort === "value" ? "Value" : "24h"}</button>
          </div>
        </div>
        <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
          {view.map((h) => (
            <div key={h.sym} className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
              <span className="font-mono text-[12px] font-bold text-accent">${h.sym}</span>
              <span className="rounded bg-white/8 px-1 text-[9px] font-bold uppercase text-faint">{h.cls}</span>
              <div className="ml-1 hidden h-1.5 max-w-[140px] flex-1 overflow-hidden rounded-full bg-white/8 sm:block"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, h.weight * 2.5)}%` }} /></div>
              <span className="ml-auto w-12 text-right text-[11px] tabular-nums text-faint">{h.weight}%</span>
              <span className="w-20 text-right text-[12px] font-bold tabular-nums">{usd(h.value)}</span>
              <span className={`w-14 text-right text-[11px] font-bold tabular-nums ${h.chg >= 0 ? "text-up" : "text-down"}`}>{h.chg >= 0 ? "+" : ""}{h.chg}%</span>
            </div>
          ))}
          {view.length === 0 && <div className="py-6 text-center text-[12px] text-faint">No holdings match.</div>}
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- Polymarket trader (markets + history + PnL) ---------------- */
export function PolyTraderModal({ trader, color, onClose }: { trader: { name: string; pnl: number; win: number; trend: number[] }; color: string; onClose: () => void }) {
  const [tab, setTab] = useState<"open" | "history">("open");
  const data = useMemo(() => {
    const r = makeRng(trader.name + "poly");
    const open = Array.from({ length: 6 }, () => { const yes = r() > 0.5; const odds = Math.round(8 + r() * 84); const stake = Math.round((2000 + r() * 180000) / 1000) * 1000; return { q: pick(r, MARKETS), yes, odds, stake, pnl: Math.round(stake * (r() * 1.6 - 0.5)) }; });
    const history = Array.from({ length: 12 }, (_, i) => { const win = r() < trader.win / 100; const stake = Math.round((1000 + r() * 120000) / 1000) * 1000; return { q: pick(r, MARKETS), yes: r() > 0.5, stake, win, payout: win ? Math.round(stake * (1.2 + r() * 1.5)) : 0, d: i + 1 }; });
    const pnl = Array.from({ length: 30 }, (_, i) => 40 + i * (trader.pnl / 1e6) * 2 + Math.sin(i / 4) * 6 + r() * 10);
    const volume = history.reduce((s, h) => s + h.stake, 0) + open.reduce((s, o) => s + o.stake, 0);
    return { open, history, pnl, volume };
  }, [trader]);

  return (
    <ModalShell title={trader.name} tag="Polymarket trader · positions & history" color={color} onClose={onClose} href={`https://polymarket.com/profile/${encodeURIComponent(trader.name)}`} hrefLabel="View on Polymarket">
      <div className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <CoolBtn primary onClick={() => follow(trader.name)}><UserPlus size={13} /> Follow on X</CoolBtn>
          <CoolBtn onClick={() => window.open(`https://polymarket.com/profile/${encodeURIComponent(trader.name)}`, "_blank")}><ExternalLink size={13} /> View on Polymarket</CoolBtn>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Realized PnL" value={"+" + usd(trader.pnl)} tone="up" />
          <Stat label="Win rate" value={trader.win + "%"} tone="accent" />
          <Stat label="Open" value={String(data.open.length)} />
          <Stat label="Volume" value={usd(data.volume)} />
        </div>
        <div className="mt-3"><RangeChart seed={trader.name + "poly"} label="Cumulative PnL" icon={<Trophy size={12} className="text-gold" />} width={760} height={140} bias={trader.win / 62} /></div>
        <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
          <div className="mb-2 flex gap-1">
            {(["open", "history"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition ${tab === t ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"}`}>{t === "open" ? "Current markets" : "Trade history"}</button>
            ))}
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {tab === "open" ? data.open.map((o, i) => (
              <div key={i} className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                <div className="flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${o.yes ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>{o.yes ? "YES" : "NO"} · {o.odds}%</span><span className="line-clamp-1 text-[12px] font-semibold">{o.q}</span></div>
                <div className="mt-1 flex items-center gap-3 text-[10.5px] text-muted"><span>Stake {usd(o.stake)}</span><span className={`ml-auto font-bold ${o.pnl >= 0 ? "text-up" : "text-down"}`}>{o.pnl >= 0 ? "+" : ""}{usd(o.pnl)} unrealized</span></div>
              </div>
            )) : data.history.map((h, i) => (
              <div key={i} className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                <div className="flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${h.win ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>{h.win ? "WON" : "LOST"}</span><span className="line-clamp-1 text-[12px] font-semibold">{h.q}</span></div>
                <div className="mt-1 flex items-center gap-3 text-[10.5px] text-muted"><span>{h.yes ? "Yes" : "No"} · stake {usd(h.stake)}</span><span className="ml-auto font-bold">{h.win ? <span className="text-up">+{usd(h.payout - h.stake)}</span> : <span className="text-down">-{usd(h.stake)}</span>}</span><span className="w-10 text-right text-[9px] text-faint">{h.d}d</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
