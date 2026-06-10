import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";

type Tone = "bull" | "bear" | "neutral";
interface Intel { id: number; src: string; dot: string; tone: Tone; title: string; impact: number; tickers: string[]; age: number; breaking?: boolean }

const TONE = {
  bull: { c: "#16e6a4", label: "Bull", Icon: TrendingUp },
  bear: { c: "#ff5a6a", label: "Bear", Icon: TrendingDown },
  neutral: { c: "#9aa3b2", label: "Neutral", Icon: Minus },
} as const;

const SRC_DOT: Record<string, string> = {
  CoinDesk: "#f7a600", "The Block": "#22d3ee", Decrypt: "#a78bfa", Bloomberg: "#ff5a6a",
  Reuters: "#f59e0b", Cointelegraph: "#ffd400", "Watcher.Guru": "#60a5fa", Polymarket: "#34d6ff",
};

const POOL: Omit<Intel, "id" | "age">[] = [
  { src: "CoinDesk", dot: SRC_DOT.CoinDesk, tone: "bull", title: "Solana DEX volume hits new ATH as memecoin activity surges", impact: 82, tickers: ["SOL"] },
  { src: "The Block", dot: SRC_DOT["The Block"], tone: "bull", title: "BlackRock files for in-kind redemptions on spot BTC ETF", impact: 74, tickers: ["BTC"] },
  { src: "Decrypt", dot: SRC_DOT.Decrypt, tone: "bull", title: "AI-agent tokens add $4B in market cap over the past week", impact: 66, tickers: ["FET", "VIRTUAL"] },
  { src: "Bloomberg", dot: SRC_DOT.Bloomberg, tone: "bear", title: "Fed minutes signal caution; rate-cut odds slip below 20%", impact: 71, tickers: ["SPX"] },
  { src: "Reuters", dot: SRC_DOT.Reuters, tone: "neutral", title: "Dollar softens as risk appetite returns to global markets", impact: 40, tickers: ["DXY"] },
  { src: "Cointelegraph", dot: SRC_DOT.Cointelegraph, tone: "bull", title: "Hyperliquid open interest tops $8B — a record for the perp DEX", impact: 69, tickers: ["HYPE"] },
  { src: "Watcher.Guru", dot: SRC_DOT["Watcher.Guru"], tone: "bear", title: "Whale moves 12,000 ETH to exchanges amid choppy price action", impact: 58, tickers: ["ETH"] },
  { src: "Polymarket", dot: SRC_DOT.Polymarket, tone: "neutral", title: "Traders price 63% odds of a green weekly close", impact: 50, tickers: [] },
  { src: "The Block", dot: SRC_DOT["The Block"], tone: "bull", title: "Stablecoin supply hits an all-time high above $190B", impact: 64, tickers: ["USDT"] },
  { src: "Decrypt", dot: SRC_DOT.Decrypt, tone: "bear", title: "Memecoin index slips 9% as rotation cools off", impact: 55, tickers: ["WIF", "BONK"] },
];

const ageLabel = (s: number) => (s < 60 ? "now" : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`);

let nid = 100;

export function IntelFeed() {
  const [items, setItems] = useState<Intel[]>(() => POOL.slice(0, 6).map((p, i) => ({ ...p, id: nid++, age: 60 * (i * 8 + 5) })));
  const [filter, setFilter] = useState<Tone | "all">("all");
  const poolRef = useRef(0);

  // Live feel: age everything every 10s, and drop a fresh "breaking" item in.
  useEffect(() => {
    const tick = setInterval(() => setItems((prev) => prev.map((x) => ({ ...x, age: x.age + 12, breaking: false }))), 12_000);
    const drop = setInterval(() => {
      poolRef.current = (poolRef.current + 3) % POOL.length;
      const base = POOL[poolRef.current];
      setItems((prev) => [{ ...base, id: nid++, age: 0, breaking: true }, ...prev.map((x) => ({ ...x, breaking: false }))].slice(0, 6));
    }, 9_000);
    return () => { clearInterval(tick); clearInterval(drop); };
  }, []);

  const net = useMemo(() => {
    const b = items.filter((x) => x.tone === "bull").length;
    const r = items.filter((x) => x.tone === "bear").length;
    const pct = items.length ? Math.round((b / Math.max(1, b + r)) * 100) : 50;
    return { b, r, pct };
  }, [items]);

  const shown = filter === "all" ? items : items.filter((x) => x.tone === filter);

  return (
    <div className="flex h-full flex-col">
      {/* control bar — live pulse + net-sentiment gauge + filters */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-up">
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up/70" /><span className="relative h-1.5 w-1.5 rounded-full bg-up" /></span>
          Live
        </span>
        {/* net sentiment gauge */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-down/30">
            <div className="h-full rounded-full bg-up transition-all duration-700" style={{ width: `${net.pct}%` }} />
          </div>
          <span className="text-[10px] font-bold tabular-nums" style={{ color: net.pct >= 50 ? TONE.bull.c : TONE.bear.c }}>{net.pct}% {net.pct >= 50 ? "bullish" : "bearish"}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {(["all", "bull", "bear", "neutral"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition ${filter === f ? "bg-accent/20 text-accent" : "text-faint hover:text-ink"}`}>{f === "all" ? "All" : TONE[f].label}</button>
          ))}
        </div>
      </div>

      <div className="vc-scroll grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((n) => {
            const t = TONE[n.tone];
            return (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-2.5 pl-3 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04]"
                style={n.breaking ? { boxShadow: `0 0 0 1px ${t.c}55, 0 0 22px ${t.c}33` } : undefined}
              >
                {/* sentiment accent rail */}
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: t.c, boxShadow: `0 0 12px ${t.c}` }} />
                {/* faint tone wash */}
                <span className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ background: `linear-gradient(90deg, ${t.c}, transparent 60%)` }} />

                <div className="relative mb-1 flex items-center gap-1.5 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.dot }} />
                  <span className="font-bold text-muted">{n.src}</span>
                  <span className="text-faint">· {ageLabel(n.age)}</span>
                  {n.breaking && <span className="flex items-center gap-0.5 rounded bg-down/20 px-1 text-[8px] font-black uppercase tracking-wider text-down"><Zap size={8} /> Breaking</span>}
                  <span className="ml-auto flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ color: t.c, background: `${t.c}1f` }}>
                    <t.Icon size={10} /> {t.label}
                  </span>
                </div>

                <div className="relative text-[12.5px] font-medium leading-snug text-ink/95">{n.title}</div>

                <div className="relative mt-2 flex items-center gap-2">
                  {/* impact meter */}
                  <span className="text-[8px] font-bold uppercase tracking-wider text-faint">Impact</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full" style={{ width: `${n.impact}%`, background: t.c }} />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums text-muted">{n.impact}</span>
                  {n.tickers.map((tk) => (
                    <span key={tk} className="rounded bg-accent/12 px-1.5 py-0.5 text-[9px] font-bold text-accent">${tk}</span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
