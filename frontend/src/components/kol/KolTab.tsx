import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Wallet, ArrowUpRight, ArrowDownRight, X as XIcon, Activity, TrendingUp, Copy, ExternalLink, UserPlus, Trophy } from "lucide-react";
import { compact } from "../../lib/format";
import { RangeChart } from "../RangeChart";
import { WatchStar } from "../WatchStar";

function makeRng(seed: string) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff; return h / 0x7fffffff; };
}

interface Holding { sym: string; usd: number; chg: number }
interface Kol {
  id: string; name: string; handle: string; wallet: string; color: string;
  balance: number; pnl24h: number; chain: "SOL" | "ETH" | "BASE"; holdings: Holding[];
}

const KOLS: Kol[] = [
  { id: "ansem", name: "Ansem", handle: "blknoiz06", wallet: "BEr…7nMq", color: "#f59e0b", balance: 41.8e6, pnl24h: 12.4, chain: "SOL", holdings: [{ sym: "WIF", usd: 9.2e6, chg: 14 }, { sym: "SOL", usd: 18e6, chg: 5 }, { sym: "POPCAT", usd: 6.1e6, chg: 22 }, { sym: "JUP", usd: 4.4e6, chg: -3 }] },
  { id: "cobie", name: "Cobie", handle: "cobie", wallet: "0x9a…4f1c", color: "#22d3ee", balance: 28.3e6, pnl24h: -2.1, chain: "ETH", holdings: [{ sym: "ETH", usd: 14e6, chg: 4 }, { sym: "ONDO", usd: 5.2e6, chg: -6 }, { sym: "AAVE", usd: 3.8e6, chg: 2 }] },
  { id: "gcr", name: "GCR", handle: "GiganticRebirth", wallet: "0x21…9ad3", color: "#a78bfa", balance: 63.1e6, pnl24h: 8.7, chain: "ETH", holdings: [{ sym: "BTC", usd: 30e6, chg: 3 }, { sym: "ETH", usd: 18e6, chg: 4 }, { sym: "HYPE", usd: 9e6, chg: 19 }] },
  { id: "hsaka", name: "Hsaka", handle: "HsakaTrades", wallet: "0x77…2bb8", color: "#34d399", balance: 19.7e6, pnl24h: 5.2, chain: "ETH", holdings: [{ sym: "SOL", usd: 8e6, chg: 5 }, { sym: "ARB", usd: 3e6, chg: -2 }, { sym: "PENDLE", usd: 2.4e6, chg: 7 }] },
  { id: "pentoshi", name: "Pentoshi", handle: "Pentosh1", wallet: "0x4c…8e0a", color: "#60a5fa", balance: 22.5e6, pnl24h: 3.1, chain: "ETH", holdings: [{ sym: "BTC", usd: 12e6, chg: 3 }, { sym: "SOL", usd: 6e6, chg: 5 }, { sym: "LINK", usd: 2.2e6, chg: 1 }] },
  { id: "murad", name: "Murad", handle: "MustStopMurad", wallet: "0x3d…1c47", color: "#f472b6", balance: 34.9e6, pnl24h: 18.9, chain: "SOL", holdings: [{ sym: "SPX", usd: 14e6, chg: 28 }, { sym: "GIGA", usd: 8e6, chg: 33 }, { sym: "MOG", usd: 5e6, chg: 12 }] },
  { id: "tetra", name: "Tetranode", handle: "Tetranode", wallet: "0x88…5d2e", color: "#fbbf24", balance: 51.2e6, pnl24h: -4.4, chain: "ETH", holdings: [{ sym: "ETH", usd: 26e6, chg: 4 }, { sym: "UNI", usd: 6e6, chg: -5 }, { sym: "AAVE", usd: 5e6, chg: 2 }] },
  { id: "unipcs", name: "Bonk Guy", handle: "theunipcs", wallet: "9xQ…eaP3", color: "#fb923c", balance: 17.3e6, pnl24h: 24.1, chain: "SOL", holdings: [{ sym: "BONK", usd: 9e6, chg: 26 }, { sym: "WIF", usd: 4e6, chg: 14 }, { sym: "PNUT", usd: 2.5e6, chg: 41 }] },
  { id: "inverse", name: "Inversebrah", handle: "inversebrah", wallet: "0x12…7f4d", color: "#c084fc", balance: 11.8e6, pnl24h: 1.2, chain: "ETH", holdings: [{ sym: "ETH", usd: 5e6, chg: 4 }, { sym: "PEPE", usd: 3e6, chg: 9 }] },
  { id: "mando", name: "Mando", handle: "mando_ftw", wallet: "0x55…3a9c", color: "#2dd4bf", balance: 14.6e6, pnl24h: 6.6, chain: "BASE", holdings: [{ sym: "VIRTUAL", usd: 5e6, chg: 16 }, { sym: "AERO", usd: 3e6, chg: 8 }] },
  { id: "cupsey", name: "Cupsey", handle: "cupseyy", wallet: "7mK…2vZ9", color: "#4ade80", balance: 9.4e6, pnl24h: 31.5, chain: "SOL", holdings: [{ sym: "POPCAT", usd: 4e6, chg: 22 }, { sym: "GOAT", usd: 2.5e6, chg: 48 }] },
  { id: "degen", name: "DegenSpartan", handle: "DegenSpartan", wallet: "0x66…1d8b", color: "#facc15", balance: 26.1e6, pnl24h: -1.8, chain: "ETH", holdings: [{ sym: "ETH", usd: 12e6, chg: 4 }, { sym: "INJ", usd: 4e6, chg: -3 }, { sym: "FET", usd: 3e6, chg: 6 }] },
];

const TOKENS = ["WIF", "BONK", "JUP", "SOL", "ETH", "POPCAT", "PNUT", "ONDO", "VIRTUAL", "FET", "PEPE", "TON", "INJ", "RENDER", "GOAT", "GIGA", "MOG", "SPX", "HYPE"];

interface Trade { id: number; kol: Kol; token: string; side: "buy" | "sell"; usd: number; ts: number }

const usd = (n: number) => "$" + compact(n);
const short = (h: string) => h;

/** Embedded X timeline for a KOL's recent posts. */
function XPosts({ handle }: { handle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.innerHTML = `<a class="twitter-timeline" data-theme="dark" data-chrome="noheader nofooter noborders transparent" data-tweet-limit="6" href="https://twitter.com/${handle}">Posts by @${handle}</a>`;
    const w = window as unknown as { twttr?: { widgets: { load: (e?: HTMLElement) => void } } };
    if (w.twttr?.widgets) w.twttr.widgets.load(el);
    else if (!document.getElementById("twttr-wjs")) { const s = document.createElement("script"); s.id = "twttr-wjs"; s.src = "https://platform.twitter.com/widgets.js"; s.async = true; document.body.appendChild(s); }
    else { const iv = setInterval(() => { const ww = (window as unknown as { twttr?: { widgets: { load: (e?: HTMLElement) => void } } }).twttr; if (ww?.widgets) { ww.widgets.load(el); clearInterval(iv); } }, 300); setTimeout(() => clearInterval(iv), 6000); }
  }, [handle]);
  return <div ref={ref} />;
}

function fmtTime(ts: number) { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

export function KolTab() {
  const [feed, setFeed] = useState<Trade[]>([]);
  const [open, setOpen] = useState<Kol | null>(null);
  const idRef = useRef(1);

  // simulated live trade firehose across all tracked KOLs
  useEffect(() => {
    const tick = () => {
      const kol = KOLS[Math.floor(Math.random() * KOLS.length)];
      const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
      const side: "buy" | "sell" = Math.random() > 0.42 ? "buy" : "sell";
      const amount = Math.round((8000 + Math.random() * 900000) / 1000) * 1000;
      setFeed((f) => [{ id: idRef.current++, kol, token, side, usd: amount, ts: Date.now() }, ...f].slice(0, 60));
    };
    tick(); tick(); tick();
    const iv = setInterval(tick, 2200 + Math.random() * 1600);
    return () => clearInterval(iv);
  }, []);

  const ranked = useMemo(() => [...KOLS].sort((a, b) => b.balance - a.balance), []);
  const totalAum = useMemo(() => KOLS.reduce((s, k) => s + k.balance, 0), []);
  const netFlow = useMemo(() => feed.reduce((s, t) => s + (t.side === "buy" ? t.usd : -t.usd), 0), [feed]);
  const hotToken = useMemo(() => {
    const m = new Map<string, number>();
    feed.filter((t) => t.side === "buy").forEach((t) => m.set(t.token, (m.get(t.token) ?? 0) + t.usd));
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  }, [feed]);

  return (
    <div className="mb-tab">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <h1 className="serif text-3xl font-bold tracking-tight sm:text-4xl">KOL Tracker</h1>
        <p className="mt-1 text-[13px] text-muted">On-chain wallets of the biggest crypto voices — balances, holdings, and a live buy/sell firehose. Click a profile for their latest posts.</p>

        {/* aggregate stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Tracked KOLs", String(KOLS.length), "wallets"],
            ["Total AUM", usd(totalAum), "across all"],
            ["Net flow (live)", (netFlow >= 0 ? "+" : "−") + usd(Math.abs(netFlow)), netFlow >= 0 ? "accumulating" : "distributing"],
            ["Hot token", hotToken, "most bought"],
          ].map(([l, v, s]) => (
            <div key={l} className="vc-glass rounded-2xl p-3">
              <div className="text-[9px] uppercase tracking-wider text-faint">{l}</div>
              <div className="mt-0.5 text-[22px] font-extrabold tabular-nums text-accent">{v}</div>
              <div className="text-[10px] text-muted">{s}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* KOL leaderboard */}
          <div className="vc-glass rounded-2xl p-4 lg:col-span-7">
            <div className="mb-3 flex items-center gap-2"><Crosshair size={15} className="text-accent" /><span className="serif text-[16px] font-bold">Tracked Wallets</span><span className="ml-auto text-[10px] uppercase tracking-wider text-faint">by balance</span></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ranked.map((k, i) => (
                <div key={k.id} role="button" tabIndex={0} onClick={() => setOpen(k)} className="group flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-2.5 text-left transition hover:border-accent/40 hover:bg-accent/5">
                  <span className="w-4 text-[11px] font-bold tabular-nums text-faint">{i + 1}</span>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-black text-black" style={{ background: k.color }}>{k.name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate text-[13px] font-bold">{k.name}</span><span className="rounded bg-white/8 px-1 text-[9px] font-bold text-faint">{k.chain}</span><WatchStar item={{ key: `kol:${k.id}`, type: "kol", label: k.name, sub: "@" + k.handle }} size={12} /></div>
                    <div className="truncate text-[10px] text-muted">@{k.handle} · {short(k.wallet)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-bold tabular-nums">{usd(k.balance)}</div>
                    <div className={`text-[10px] font-bold tabular-nums ${k.pnl24h >= 0 ? "text-up" : "text-down"}`}>{k.pnl24h >= 0 ? "+" : ""}{k.pnl24h}% 24h</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* live trade firehose */}
          <div className="vc-glass flex flex-col rounded-2xl p-4 lg:col-span-5" style={{ height: 620 }}>
            <div className="mb-3 flex items-center gap-2"><Activity size={15} className="text-up" /><span className="serif text-[16px] font-bold">Live Activity</span><span className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-up"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" />live</span></div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {feed.map((t) => (
                  <motion.button
                    key={t.id}
                    onClick={() => setOpen(t.kol)}
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex w-full items-center gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-1.5 text-left hover:border-white/20"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-black" style={{ background: t.kol.color }}>{t.kol.name[0]}</span>
                    <span className={`flex shrink-0 items-center gap-0.5 text-[11px] font-bold ${t.side === "buy" ? "text-up" : "text-down"}`}>{t.side === "buy" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{t.side.toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px]"><span className="font-bold">{t.kol.name}</span> <span className="text-muted">{t.side === "buy" ? "bought" : "sold"}</span> <span className="font-mono font-bold text-accent">${t.token}</span></span>
                    <span className="shrink-0 text-right text-[11px] font-bold tabular-nums">{usd(t.usd)}</span>
                    <span className="shrink-0 text-[9px] tabular-nums text-faint">{fmtTime(t.ts)}</span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* KOL profile modal */}
      <AnimatePresence>
        {open && <KolProfile key={open.id} kol={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}

/** Big, detailed KOL profile dashboard — KPIs, balance graph, allocation, live trades, X posts. */
function KolProfile({ kol, onClose }: { kol: Kol; onClose: () => void }) {
  const [feed, setFeed] = useState<{ id: number; token: string; side: "buy" | "sell"; usd: number; ts: number }[]>([]);
  const idRef = useRef(1);

  const d = useMemo(() => {
    const r = makeRng(kol.id);
    const win = 55 + Math.floor(r() * 22);
    const trades = 80 + Math.floor(r() * 220);
    const realized = Math.round(kol.balance * (0.4 + r() * 1.6));
    const pnl7d = +(kol.pnl24h * 1.4 + (r() * 28 - 11)).toFixed(1);
    const pnl30d = +(kol.pnl24h * 2.2 + (r() * 60 - 18)).toFixed(1);
    const equity = Array.from({ length: 34 }, (_, i) => 50 + i * (kol.pnl24h / 7) + Math.sin(i / 3) * 7 + r() * 12);
    const followers = Math.round(40 + r() * 950) * 1000;
    const allocOther = Math.max(0, kol.balance - kol.holdings.reduce((s, h) => s + h.usd, 0));
    return { win, trades, wins: Math.round((trades * win) / 100), realized, pnl7d, pnl30d, equity, followers, allocOther };
  }, [kol]);

  useEffect(() => {
    const tokens = [...kol.holdings.map((h) => h.sym), ...TOKENS];
    const r = makeRng(kol.id + "live");
    const tick = () => {
      const side: "buy" | "sell" = r() > 0.45 ? "buy" : "sell";
      const amount = Math.round((4000 + r() * 480000) / 1000) * 1000;
      setFeed((f) => [{ id: idRef.current++, token: tokens[Math.floor(r() * tokens.length)], side, usd: amount, ts: Date.now() }, ...f].slice(0, 18));
    };
    tick(); tick(); const iv = setInterval(tick, 2100);
    return () => clearInterval(iv);
  }, [kol]);

  const kpis: [string, string, "up" | "down" | "accent" | ""][] = [
    ["Balance", usd(kol.balance), "accent"],
    ["24h PnL", `${kol.pnl24h >= 0 ? "+" : ""}${kol.pnl24h}%`, kol.pnl24h >= 0 ? "up" : "down"],
    ["7d PnL", `${d.pnl7d >= 0 ? "+" : ""}${d.pnl7d}%`, d.pnl7d >= 0 ? "up" : "down"],
    ["30d PnL", `${d.pnl30d >= 0 ? "+" : ""}${d.pnl30d}%`, d.pnl30d >= 0 ? "up" : "down"],
    ["Realized", "+" + usd(d.realized), "up"],
    ["Win rate", d.win + "%", "accent"],
    ["Trades", String(d.trades), ""],
    ["Followers", compact(d.followers), ""],
  ];

  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="mb-tab mt-8 w-full max-w-5xl rounded-2xl border border-white/10 bg-[#111]" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center gap-3 border-b border-white/8 p-4">
          <span className="grid h-12 w-12 place-items-center rounded-full text-[18px] font-black text-black" style={{ background: kol.color }}>{kol.name[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="serif text-xl font-bold">{kol.name}</span><span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-faint">{kol.chain}</span><span className="font-mono text-[11px] text-faint">{short(kol.wallet)}</span></div>
            <a href={`https://x.com/${kol.handle}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] text-accent hover:underline">@{kol.handle} <ExternalLink size={11} /></a>
          </div>
          <div className="hidden gap-2 sm:flex">
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => navigator.clipboard?.writeText(kol.wallet)} className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-[12px] font-bold text-black shadow-neon"><Copy size={13} /> Copy wallet</motion.button>
            <motion.a whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} href={`https://x.com/intent/follow?screen_name=${kol.handle}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-[12px] font-bold text-ink hover:border-accent/50 hover:text-accent"><UserPlus size={13} /> Follow on X</motion.a>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><XIcon size={18} /></button>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-2 p-4 pb-0 sm:grid-cols-4 lg:grid-cols-8">
          {kpis.map(([l, v, tone]) => (
            <div key={l} className="rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-faint">{l}</div>
              <div className={`mt-0.5 text-[15px] font-extrabold tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "accent" ? "text-accent" : ""}`}>{v}</div>
            </div>
          ))}
        </div>

        {/* balance equity curve */}
        <div className="px-4 pt-3">
          <RangeChart seed={kol.id} label="Portfolio value" icon={<Trophy size={12} className="text-gold" />} width={900} height={130} bias={Math.max(0.7, kol.pnl24h / 11)} />
        </div>

        {/* holdings + live trades + posts */}
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_1fr_0.9fr]">
          {/* holdings with allocation bars */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><Wallet size={12} /> Holdings</div>
            <div className="space-y-1.5">
              {kol.holdings.map((h) => {
                const wt = (h.usd / kol.balance) * 100;
                return (
                  <div key={h.sym} className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2">
                    <div className="flex items-center gap-2 text-[12px]"><span className="font-mono font-bold text-accent">${h.sym}</span><span className="ml-auto font-bold tabular-nums">{usd(h.usd)}</span><span className={`w-12 text-right text-[11px] font-bold tabular-nums ${h.chg >= 0 ? "text-up" : "text-down"}`}>{h.chg >= 0 ? "+" : ""}{h.chg}%</span></div>
                    <div className="mt-1 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, wt)}%` }} /></div><span className="w-9 text-right text-[9px] text-faint">{wt.toFixed(0)}%</span></div>
                  </div>
                );
              })}
              {d.allocOther > 0 && <div className="px-2.5 text-[10px] text-faint">+ {usd(d.allocOther)} in other assets / stables</div>}
            </div>
          </div>

          {/* live trades */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><Activity size={12} className="text-up" /> Live Trades <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-up" /></div>
            <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {feed.map((t) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[11.5px]">
                    <span className={`flex items-center gap-0.5 font-bold ${t.side === "buy" ? "text-up" : "text-down"}`}>{t.side === "buy" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{t.side.toUpperCase()}</span>
                    <span className="font-mono font-bold text-accent">${t.token}</span>
                    <span className="ml-auto tabular-nums text-muted">{usd(t.usd)}</span>
                    <span className="w-12 text-right text-[9px] tabular-nums text-faint">{fmtTime(t.ts)}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* latest posts */}
          <div className="min-h-0">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><XIcon size={12} /> Latest Posts</div>
            <div className="max-h-[360px] overflow-y-auto rounded-lg border border-white/8"><XPosts handle={kol.handle} /></div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
