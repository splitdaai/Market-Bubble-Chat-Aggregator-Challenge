import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X as XIcon, Star, Calculator, TrendingUp, ExternalLink } from "lucide-react";
import { useWatchlistStore, useOwnerId } from "@/store/watchlistStore";
import { Sparkline } from "./Sparkline";
import { compact } from "@/lib/format";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";
type Pts = { t: number; c: number }[];
const usd = (n: number) => (n < 0 ? "-$" : "$") + compact(Math.abs(n));
const fmtPx = (n: number) => n >= 1000 ? "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "$" + n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 });
const priceAt = (pts: Pts, ts: number) => {
  if (!pts.length) return 0;
  let best = pts[0];
  for (const p of pts) { if (p.t <= ts) best = p; else break; }
  return best.c;
};

export function WatchlistDashboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const owner = useOwnerId();
  const items = useWatchlistStore((s) => s.byOwner[owner] ?? []);
  const assets = useMemo(() => items.filter((i) => i.type === "asset"), [items]);
  const others = useMemo(() => items.filter((i) => i.type !== "asset"), [items]);

  const [hist, setHist] = useState<Record<string, Pts>>({});
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [entries, setEntries] = useState<Record<string, number>>({});
  const [buyDate, setBuyDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); });

  // fetch history for each watchlisted asset
  useEffect(() => {
    if (!open) return;
    assets.forEach((a) => {
      const sym = a.label;
      if (hist[sym]) return;
      fetch(`${BACKEND}/api/price-history?sym=${encodeURIComponent(sym)}`)
        .then((r) => r.json())
        .then((j) => { if (Array.isArray(j.points)) setHist((h) => ({ ...h, [sym]: j.points })); })
        .catch(() => {});
    });
  }, [open, assets, hist]);

  const buyTs = new Date(buyDate).getTime();
  const rows = assets.map((a) => {
    const pts = hist[a.label] ?? [];
    const entryDefault = priceAt(pts, buyTs);
    const entry = entries[a.label] ?? entryDefault; // custom entry overrides the date-derived price
    const now = pts.length ? pts[pts.length - 1].c : 0;
    const amount = amounts[a.label] ?? 1000;
    const units = entry ? amount / entry : 0;
    const value = units * now;
    const pnl = value - amount;
    const pnlPct = amount ? (pnl / amount) * 100 : 0;
    return { sym: a.label, pts, entry, entryDefault, custom: entries[a.label] !== undefined, now, amount, units, value, pnl, pnlPct, loading: !pts.length };
  });

  const invested = rows.reduce((s, r) => s + r.amount, 0);
  const value = rows.reduce((s, r) => s + r.value, 0);
  const pnl = value - invested;
  const pnlPct = invested ? (pnl / invested) * 100 : 0;
  const best = [...rows].filter((r) => !r.loading).sort((a, b) => b.pnlPct - a.pnlPct)[0];
  const worst = [...rows].filter((r) => !r.loading).sort((a, b) => a.pnlPct - b.pnlPct)[0];

  // combined portfolio value curve since buy date
  const curve = useMemo(() => {
    const loaded = rows.filter((r) => r.pts.length && r.entry);
    if (!loaded.length) return [];
    const days: number[] = [];
    for (let t = buyTs; t <= Date.now(); t += 86400000) days.push(t);
    return days.map((d) => loaded.reduce((sum, r) => sum + (r.amount / r.entry) * priceAt(r.pts, d), 0));
  }, [rows, buyTs]);

  const setAll = (v: number) => setAmounts(Object.fromEntries(assets.map((a) => [a.label, v])));

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="mb-tab mt-6 w-full max-w-5xl rounded-2xl border border-white/10 bg-[#111]" initial={{ scale: 0.97, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-white/8 p-4">
              <Star size={18} className="text-gold" />
              <div className="serif text-xl font-bold">Watchlist Dashboard</div>
              <span className="text-[11px] uppercase tracking-wider text-faint">{assets.length} assets</span>
              <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><XIcon size={18} /></button>
            </div>

            {assets.length === 0 ? (
              <div className="p-10 text-center text-muted">Add assets to your watchlist (tap the ☆ on Global Markets) to model a portfolio here.</div>
            ) : (
              <div className="p-4">
                {/* controls */}
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2"><Calculator size={14} className="text-accent" /><span className="text-[11px] font-bold uppercase tracking-wider text-muted">If I'd bought on</span>
                    <input type="date" value={buyDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBuyDate(e.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[12px] text-ink outline-none [color-scheme:dark]" />
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted">Set each to
                    {[100, 1000, 10000].map((v) => <button key={v} onClick={() => setAll(v)} className="rounded-md border border-white/10 px-2 py-1 font-bold text-ink hover:border-accent/50 hover:text-accent">${compact(v)}</button>)}
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ["Invested", usd(invested), ""],
                    ["Current value", usd(value), ""],
                    ["Total P&L", (pnl >= 0 ? "+" : "") + usd(pnl), pnl >= 0 ? "up" : "down"],
                    ["Return", (pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(1) + "%", pnlPct >= 0 ? "up" : "down"],
                    ["Best", best ? `${best.sym} ${best.pnlPct >= 0 ? "+" : ""}${best.pnlPct.toFixed(0)}%` : "—", "up"],
                    ["Worst", worst ? `${worst.sym} ${worst.pnlPct >= 0 ? "+" : ""}${worst.pnlPct.toFixed(0)}%` : "—", "down"],
                  ].map(([l, v, tone]) => (
                    <div key={l} className="rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-2 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-faint">{l}</div>
                      <div className={`mt-0.5 text-[15px] font-extrabold tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-accent"}`}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* combined performance graph */}
                <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-faint"><span className="flex items-center gap-1"><TrendingUp size={12} /> Combined portfolio value · since {buyDate}</span><span className={pnlPct >= 0 ? "text-up" : "text-down"}>{pnlPct >= 0 ? "▲" : "▼"} {Math.abs(pnlPct).toFixed(1)}%</span></div>
                  {curve.length > 1 ? <Sparkline data={curve} width={900} height={140} color={pnlPct >= 0 ? "#16e6a4" : "#ff5a6a"} /> : <div className="py-10 text-center text-[12px] text-faint">Loading price history…</div>}
                </div>

                {/* per-asset calculator */}
                <div className="mt-3 overflow-hidden rounded-xl border border-white/8">
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 border-b border-white/8 bg-white/[0.03] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-faint">
                    <span>Asset</span><span className="text-right">Entry $ → now</span><span className="text-right">Amount $</span><span className="text-right">Value</span><span className="text-right">P&L</span>
                  </div>
                  {rows.map((r) => (
                    <div key={r.sym} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 border-b border-white/6 px-3 py-2 text-[12px]">
                      <span className="flex items-center gap-2 font-mono font-bold text-accent">${r.sym}{r.pts.length > 1 && <Sparkline data={r.pts.slice(-30).map((p) => p.c)} width={48} height={14} color={r.pnl >= 0 ? "#16e6a4" : "#ff5a6a"} />}</span>
                      <span className="flex items-center justify-end gap-1 tabular-nums text-muted">
                        {r.loading ? "…" : (
                          <>
                            <span className="text-faint">$</span>
                            <input type="number" value={r.custom ? r.entry : +r.entryDefault.toFixed(r.entryDefault < 1 ? 4 : 2)} onChange={(e) => setEntries((s) => ({ ...s, [r.sym]: Math.max(0, +e.target.value) }))} title="Set your entry price" className="w-20 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-right tabular-nums outline-none focus:border-accent/50" />
                            <span className="whitespace-nowrap text-faint">→ {fmtPx(r.now)}</span>
                            {r.custom && <button onClick={() => setEntries((s) => { const c = { ...s }; delete c[r.sym]; return c; })} title="Reset to date price" className="rounded px-0.5 text-[11px] text-faint hover:text-accent">↺</button>}
                          </>
                        )}
                      </span>
                      <span className="text-right"><input type="number" value={r.amount} onChange={(e) => setAmounts((a) => ({ ...a, [r.sym]: Math.max(0, +e.target.value) }))} className="w-20 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-right tabular-nums outline-none" /></span>
                      <span className="text-right font-bold tabular-nums">{r.loading ? "…" : usd(r.value)}</span>
                      <span className={`text-right font-bold tabular-nums ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{r.loading ? "…" : `${r.pnl >= 0 ? "+" : ""}${usd(r.pnl)} (${r.pnlPct >= 0 ? "+" : ""}${r.pnlPct.toFixed(0)}%)`}</span>
                    </div>
                  ))}
                </div>

                {others.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">Also watching</div>
                    <div className="flex flex-wrap gap-1.5">
                      {others.map((o) => <span key={o.key} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] px-2 py-1 text-[11px]"><span className="rounded bg-white/8 px-1 text-[8px] font-bold uppercase text-faint">{o.type}</span>{o.label}</span>)}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-center text-[10px] text-faint">Live historical prices · CoinGecko (crypto) & Yahoo (indices/commodities). <ExternalLink size={9} className="inline" /> Educational, not financial advice.</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
