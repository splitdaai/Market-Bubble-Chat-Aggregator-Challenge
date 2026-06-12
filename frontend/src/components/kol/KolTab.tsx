import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Wallet, ArrowUpRight, ArrowDownRight, X as XIcon, Activity, TrendingUp, ExternalLink, UserPlus, Trophy } from "lucide-react";
import { compact } from "../../lib/format";
import { Sparkline } from "../Sparkline";
import { WatchStar } from "../WatchStar";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";
const usd = (n: number) => (n < 0 ? "-$" : "$") + compact(Math.abs(n));
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Named crypto KOLs — for their real X feeds (on-chain wallets aren't publicly linkable). */
const KOLS = [
  { id: "ansem", name: "Ansem", handle: "blknoiz06", color: "#f59e0b" },
  { id: "cobie", name: "Cobie", handle: "cobie", color: "#22d3ee" },
  { id: "gcr", name: "GCR", handle: "GCRClassic", color: "#a78bfa" },
  { id: "hsaka", name: "Hsaka", handle: "HsakaTrades", color: "#34d399" },
  { id: "pentoshi", name: "Pentoshi", handle: "Pentosh1", color: "#60a5fa" },
  { id: "murad", name: "Murad", handle: "MustStopMurad", color: "#f472b6" },
  { id: "tetra", name: "Tetranode", handle: "Tetranode", color: "#fbbf24" },
  { id: "unipcs", name: "Bonk Guy", handle: "theunipcs", color: "#fb923c" },
  { id: "cupsey", name: "Cupsey", handle: "cupseyy", color: "#4ade80" },
  { id: "mando", name: "Mando", handle: "mando_ftw", color: "#2dd4bf" },
  { id: "inverse", name: "Inversebrah", handle: "inversebrah", color: "#c084fc" },
  { id: "degen", name: "DegenSpartan", handle: "DegenSpartan", color: "#facc15" },
];

interface HlTrader { name: string; addr: string; pnl: number; roi?: number; value: number; xHandle?: string }
interface Linked { name: string; xHandle: string; addr: string; chain: "hl" | "evm"; value: number; pnl: number; top?: string }
interface Holding { sym: string; amount: number; usd: number }
interface Position { coin: string; long: boolean; szi: number; entry: number; upnl: number; lev: number; value: number }
interface Fill { coin: string; buy: boolean; sz: number; px: number; t: number; dir: string; closedPnl?: number }
interface WalletData { addr: string; accountValue: number; positions: Position[]; fills: Fill[]; chart: Record<string, number[]>; kpis?: { winRate: number | null; trades: number; wins: number } }

function XPosts({ handle }: { handle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.innerHTML = `<a class="twitter-timeline" data-theme="dark" data-chrome="noheader nofooter noborders transparent" data-tweet-limit="6" href="https://twitter.com/${handle}">Posts by @${handle}</a>`;
    const w = window as unknown as { twttr?: { widgets: { load: (e?: HTMLElement) => void } } };
    if (w.twttr?.widgets) w.twttr.widgets.load(el);
    else { const iv = setInterval(() => { const ww = (window as unknown as { twttr?: { widgets: { load: (e?: HTMLElement) => void } } }).twttr; if (ww?.widgets) { ww.widgets.load(el); clearInterval(iv); } }, 300); setTimeout(() => clearInterval(iv), 6000); }
  }, [handle]);
  return <div ref={ref} />;
}

/* ---- Real Hyperliquid wallet profile (live positions + fills + value chart) ---- */
export function HlWalletModal({ trader, onClose }: { trader: HlTrader; onClose: () => void }) {
  const [w, setW] = useState<WalletData | null>(null);
  const [range, setRange] = useState("month");
  useEffect(() => {
    let on = true;
    fetch(`${BACKEND}/api/hl-wallet?addr=${encodeURIComponent(trader.addr)}`).then((r) => r.json()).then((j) => { if (on && j.addr) setW(j); }).catch(() => {});
    return () => { on = false; };
  }, [trader.addr]);
  const series = w?.chart?.[range] ?? [];
  // % change off the first NON-ZERO point — "All" starts at $0 (first deposit),
  // which would otherwise divide-by-zero into Infinity%.
  const base = series.find((v) => v > 0) ?? 0;
  const chgPct = base > 0 && series.length > 1 ? (series[series.length - 1] / base - 1) * 100 : 0;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 pb-10 pt-24 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="mb-tab w-full max-w-5xl rounded-2xl border border-white/10 bg-[#111]" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/8 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/20 text-[15px] font-black text-accent">HL</span>
          <div className="min-w-0 flex-1">
            <a href={`https://app.hyperliquid.xyz/explorer/address/${trader.addr}`} target="_blank" rel="noreferrer" className="serif inline-flex items-center gap-1.5 text-xl font-bold hover:text-accent hover:underline">{trader.name} <ExternalLink size={14} /></a>
            <div className="font-mono text-[11px] text-faint">{trader.addr.slice(0, 10)}…{trader.addr.slice(-8)} · Hyperliquid · <span className="text-up">● live on-chain</span></div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><XIcon size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 pb-0 sm:grid-cols-4">
          {[["Account value", usd(w?.accountValue ?? trader.value)], ["30D PnL", (trader.pnl >= 0 ? "+" : "") + usd(trader.pnl), trader.pnl >= 0 ? "up" : "down"], ["30D ROI", (trader.roi ?? 0).toFixed(1) + "%", "accent"], ["Win rate", w?.kpis ? (w.kpis.winRate != null ? `${w.kpis.winRate}%` : "n/a") : "…", (w?.kpis?.winRate ?? 0) >= 50 ? "up" : "down"]].map(([l, v, tone]) => (
            <div key={l} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-center"><div className="text-[9px] uppercase tracking-wider text-faint">{l}</div><div className={`mt-0.5 text-[16px] font-extrabold tabular-nums ${tone === "up" ? "text-up" : tone === "accent" ? "text-accent" : ""}`}>{v}</div></div>
          ))}
        </div>

        {/* real portfolio-value chart */}
        <div className="px-4 pt-3">
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-faint"><Trophy size={12} className="text-gold" /> Account value · live</span>
              <div className="flex items-center gap-2">
                {series.length > 1 && <span className="text-[13px] font-extrabold tabular-nums">{usd(series[series.length - 1])}</span>}
                <div className="flex gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5">
                  {[["day", "1D"], ["week", "7D"], ["month", "30D"], ["allTime", "All"]].map(([k, l]) => (
                    <button key={k} onClick={() => setRange(k)} className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition ${range === k ? "bg-accent/20 text-accent" : "text-faint hover:text-ink"}`}>{l}</button>
                  ))}
                </div>
                <span className={`text-[11px] font-bold tabular-nums ${chgPct >= 0 ? "text-up" : "text-down"}`}>{chgPct >= 0 ? "▲" : "▼"} {Math.abs(chgPct).toFixed(1)}%</span>
              </div>
            </div>
            {series.length > 1 ? (
              <div className="flex gap-2">
                {/* $ Y-axis: high / mid / low of the visible window */}
                <div className="flex w-12 shrink-0 flex-col justify-between py-0.5 text-right text-[9px] tabular-nums text-faint">
                  <span>{usd(Math.max(...series))}</span>
                  <span>{usd((Math.max(...series) + Math.min(...series)) / 2)}</span>
                  <span>{usd(Math.min(...series))}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Sparkline data={series} width={900} height={130} fitWidth color={chgPct >= 0 ? "#16e6a4" : "#ff5a6a"} />
                </div>
              </div>
            ) : <div className="py-10 text-center text-[12px] text-faint">{w ? "No history for this window." : "Loading live wallet…"}</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          {/* real open positions */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><Wallet size={12} /> Open positions</div>
            <div className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
              {(w?.positions ?? []).map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[11.5px]">
                  <span className={`font-bold ${p.long ? "text-up" : "text-down"}`}>{p.long ? "LONG" : "SHORT"}</span>
                  <span className="font-mono font-bold text-accent">{p.coin}</span>
                  {p.lev ? <span className="text-faint">{p.lev}x</span> : null}
                  <span className="ml-auto tabular-nums text-muted">{usd(p.value)}</span>
                  <span className={`w-16 text-right font-bold tabular-nums ${p.upnl >= 0 ? "text-up" : "text-down"}`}>{p.upnl >= 0 ? "+" : ""}{usd(p.upnl)}</span>
                </div>
              ))}
              {w && w.positions.length === 0 && <div className="py-4 text-center text-[11px] text-faint">No open positions right now. This wallet is flat; recent fills are still shown when Hyperliquid returns them.</div>}
              {!w && <div className="py-4 text-center text-[11px] text-faint">Loading…</div>}
            </div>
          </div>
          {/* real recent fills */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><Activity size={12} className="text-up" /> Recent trades (live fills)</div>
            <div className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
              {(w?.fills ?? []).map((f, i) => {
                const closing = /close/i.test(f.dir);
                const pnl = f.closedPnl ?? 0;
                return (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[11.5px]">
                    <span className={`flex items-center gap-0.5 font-bold ${f.buy ? "text-up" : "text-down"}`}>{f.buy ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{f.buy ? "BUY" : "SELL"}</span>
                    <span className="font-mono font-bold text-accent">{f.coin}</span>
                    <span className="truncate text-faint">{f.dir}</span>
                    <span className="ml-auto tabular-nums text-muted">{compact(f.sz)} @ ${compact(f.px)}</span>
                    {/* realized PnL chip — shown for every closing trade (green/red ±) */}
                    {closing ? (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${pnl >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>{pnl >= 0 ? "+" : "−"}{usd(Math.abs(pnl))}</span>
                    ) : (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">open</span>
                    )}
                    <span className="w-10 text-right text-[9px] text-faint">{fmtTime(f.t)}</span>
                  </div>
                );
              })}
              {w && w.fills.length === 0 && <div className="py-4 text-center text-[11px] text-faint">No recent fills returned for this address. It may be inactive, a vault shell, or an agent wallet instead of the actual trading account.</div>}
              {!w && <div className="py-4 text-center text-[11px] text-faint">Loading…</div>}
            </div>
          </div>
        </div>
        {trader.xHandle && (
          <div className="border-t border-white/8 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><XIcon size={12} /> Latest posts · <a href={`https://x.com/${trader.xHandle}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">@{trader.xHandle}</a></div>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-white/8"><XPosts handle={trader.xHandle} /></div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function KolXModal({ kol, onClose }: { kol: { name: string; handle: string; color: string }; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="mb-tab mt-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#111]" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/8 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-full text-[15px] font-black text-black" style={{ background: kol.color }}>{kol.name[0]}</span>
          <div className="min-w-0 flex-1"><div className="serif text-lg font-bold">{kol.name}</div><div className="text-[11px] text-muted">@{kol.handle}</div></div>
          <motion.a whileTap={{ scale: 0.95 }} href={`https://x.com/intent/follow?screen_name=${kol.handle}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-[12px] font-bold text-black"><UserPlus size={13} /> Follow</motion.a>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><XIcon size={18} /></button>
        </div>
        <div className="p-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Latest posts · live from X</div>
          <div className="max-h-[460px] overflow-y-auto rounded-lg border border-white/8"><XPosts handle={kol.handle} /></div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* Real EVM wallet holdings (ENS + Blockscout) + the trader's X feed. */
function EvmWalletModal({ trader, onClose }: { trader: Linked; onClose: () => void }) {
  const [w, setW] = useState<{ addr: string; ens: string; totalUsd: number; holdings: Holding[] } | null>(null);
  useEffect(() => {
    let on = true;
    fetch(`${BACKEND}/api/evm-wallet?id=${trader.addr}`).then((r) => r.json()).then((j) => { if (on && j.addr) setW(j); }).catch(() => {});
    return () => { on = false; };
  }, [trader.addr]);
  const total = w?.totalUsd ?? trader.value;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="mb-tab mt-10 w-full max-w-3xl rounded-2xl border border-white/10 bg-[#111]" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/8 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/20 text-[14px] font-black text-accent">{trader.name[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="serif text-xl font-bold">{trader.name}</span><span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-accent">✓ disclosed</span></div>
            <div className="font-mono text-[11px] text-faint"><a href={`https://etherscan.io/address/${w?.addr ?? trader.addr}`} target="_blank" rel="noreferrer" className="hover:text-accent">{(w?.ens || trader.addr).slice(0, 24)}</a> · Ethereum · <a href={`https://x.com/${trader.xHandle}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">@{trader.xHandle}</a></div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><XIcon size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4 pb-0">
          {[["Portfolio value", usd(total)], ["Holdings", String(w?.holdings.length ?? "…")], ["Chain", "Ethereum"]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-center"><div className="text-[9px] uppercase tracking-wider text-faint">{l}</div><div className="mt-0.5 text-[16px] font-extrabold tabular-nums text-accent">{v}</div></div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><Wallet size={12} /> Token holdings · live</div>
            <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {(w?.holdings ?? []).map((h, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[12px]">
                  <span className="font-mono font-bold text-accent">{h.sym}</span>
                  <span className="ml-auto tabular-nums text-muted">{compact(h.amount)}</span>
                  <span className="w-20 text-right font-bold tabular-nums">{usd(h.usd)}</span>
                  <span className="w-12 text-right text-[10px] text-faint">{total ? Math.round((h.usd / total) * 100) : 0}%</span>
                </div>
              ))}
              {w && w.holdings.length === 0 && <div className="py-4 text-center text-[11px] text-faint">No token holdings &gt;$1 in this wallet (may hold elsewhere).</div>}
              {!w && <div className="py-4 text-center text-[11px] text-faint">Loading live holdings…</div>}
            </div>
          </div>
          <div className="min-h-0">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><XIcon size={12} /> Latest posts</div>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-white/8"><XPosts handle={trader.xHandle} /></div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function KolTab() {
  const [hl, setHl] = useState<HlTrader[]>([]);
  const [linked, setLinked] = useState<Linked[]>([]);
  const [openWallet, setOpenWallet] = useState<HlTrader | null>(null);
  const [openEvm, setOpenEvm] = useState<Linked | null>(null);
  const [openKol, setOpenKol] = useState<typeof KOLS[number] | null>(null);

  useEffect(() => {
    let on = true;
    const load = () => fetch(`${BACKEND}/api/leaderboards?t=${Math.floor(Date.now() / 300000)}`).then((r) => r.json()).then((j) => { if (!on) return; if (Array.isArray(j.hyperliquid)) setHl(j.hyperliquid); if (Array.isArray(j.linked)) setLinked(j.linked); }).catch(() => {});
    load();
    const iv = setInterval(load, 600_000);
    return () => { on = false; clearInterval(iv); };
  }, []);

  // active wallets (real balance) first — these have real positions to show
  const wallets = useMemo(() => [...hl].sort((a, b) => b.value - a.value), [hl]);
  const totalAum = useMemo(() => wallets.reduce((s, w) => s + (w.value || 0), 0), [wallets]);

  return (
    <div className="mb-tab">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <h1 className="serif text-3xl font-bold tracking-tight sm:text-4xl">KOL &amp; Smart-Money Tracker</h1>
        <p className="mt-1 text-[13px] text-muted">Live on-chain wallets from Hyperliquid — real balances, positions &amp; trades — plus the biggest crypto voices on X.</p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Tracked wallets", String(wallets.length), "Hyperliquid · live"], ["Total AUM", usd(totalAum), "real account value"], ["KOLs on X", String(KOLS.length), "live X feeds"], ["Data", "Live", "on-chain + X"]].map(([l, v, s]) => (
            <div key={l} className="vc-glass rounded-2xl p-3"><div className="text-[9px] uppercase tracking-wider text-faint">{l}</div><div className="mt-0.5 text-[22px] font-extrabold tabular-nums text-accent">{v}</div><div className="text-[10px] text-muted">{s}</div></div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Smart money — real Hyperliquid wallets */}
          <div className="vc-glass rounded-2xl p-4 lg:col-span-8">
            <div className="mb-3 flex items-center gap-2"><Crosshair size={15} className="text-accent" /><span className="serif text-[16px] font-bold">Smart Money · Hyperliquid</span><span className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-up"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" />live on-chain</span></div>

            {linked.length > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent"><XIcon size={11} /> Verified · X-linked wallets</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {linked.map((k) => (
                    <div key={k.addr} role="button" tabIndex={0} onClick={() => k.chain === "evm" ? setOpenEvm(k) : setOpenWallet({ name: k.name, addr: k.addr, pnl: k.pnl, value: k.value, xHandle: k.xHandle })} className="group flex cursor-pointer items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 p-2.5 transition hover:border-accent/60">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/20 text-[12px] font-black text-accent">{k.name[0]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5"><span className="truncate text-[13px] font-bold">{k.name}</span><span className="rounded bg-accent/20 px-1 text-[8px] font-bold uppercase text-accent">✓ disclosed</span><WatchStar item={{ key: `hlwallet:${k.addr}`, type: "trader", label: k.name, sub: "@" + k.xHandle }} size={11} /></div>
                        <a href={`https://x.com/${k.xHandle}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-accent hover:underline">@{k.xHandle}</a>
                      </div>
                      <div className="text-right"><div className="text-[13px] font-bold tabular-nums">{usd(k.value)}</div>{k.chain === "evm" ? <div className="text-[10px] font-bold text-faint">{k.top ? `top: ${k.top}` : "holdings"}</div> : <div className={`text-[10px] font-bold tabular-nums ${k.pnl >= 0 ? "text-up" : "text-down"}`}>{k.pnl >= 0 ? "+" : ""}{usd(k.pnl)} 30d</div>}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-faint">Top by account value</div>
              </div>
            )}
            {wallets.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-faint">Loading live Hyperliquid wallets…</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {wallets.slice(0, 50).map((t, i) => (
                  <div key={t.addr} role="button" tabIndex={0} onClick={() => setOpenWallet(t)} className="group flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-2.5 transition hover:border-accent/40 hover:bg-accent/5">
                    <span className="w-4 text-[11px] font-bold tabular-nums text-faint">{i + 1}</span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-black text-accent">HL</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5"><span className="truncate text-[13px] font-bold">{t.name}</span><WatchStar item={{ key: `hlwallet:${t.addr}`, type: "trader", label: t.name, sub: "HL" }} size={12} /></div>
                      <div className="truncate font-mono text-[10px] text-muted">{t.addr.slice(0, 8)}…{t.addr.slice(-6)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold tabular-nums">{usd(t.value)}</div>
                      <div className={`text-[10px] font-bold tabular-nums ${t.pnl >= 0 ? "text-up" : "text-down"}`}>{t.pnl >= 0 ? "+" : ""}{usd(t.pnl)} 30d</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KOLs on X */}
          <div className="vc-glass rounded-2xl p-4 lg:col-span-4">
            <div className="mb-1 flex items-center gap-2"><XIcon size={14} className="text-accent" /><span className="serif text-[16px] font-bold">KOLs on X</span></div>
            <div className="mb-3 text-[10px] text-faint">Crypto voices — live X feeds. On-chain wallets aren't publicly linked to these accounts.</div>
            <div className="space-y-1.5">
              {KOLS.map((k) => (
                <div key={k.id} role="button" tabIndex={0} onClick={() => setOpenKol(k)} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-2 transition hover:border-accent/40 hover:bg-accent/5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-black text-black" style={{ background: k.color }}>{k.name[0]}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-bold">{k.name}</div><div className="truncate text-[10px] text-muted">@{k.handle}</div></div>
                  <WatchStar item={{ key: `kol:${k.id}`, type: "kol", label: k.name, sub: "@" + k.handle }} size={12} />
                  <a href={`https://x.com/intent/follow?screen_name=${k.handle}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-muted hover:border-accent/50 hover:text-accent">Follow</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>{openWallet && <HlWalletModal key={openWallet.addr} trader={openWallet} onClose={() => setOpenWallet(null)} />}</AnimatePresence>
      <AnimatePresence>{openEvm && <EvmWalletModal key={openEvm.addr} trader={openEvm} onClose={() => setOpenEvm(null)} />}</AnimatePresence>
      <AnimatePresence>{openKol && <KolXModal key={openKol.id} kol={openKol} onClose={() => setOpenKol(null)} />}</AnimatePresence>
    </div>
  );
}
