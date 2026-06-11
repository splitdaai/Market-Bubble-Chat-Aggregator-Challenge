import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

type Tone = "bull" | "bear" | "neutral";
interface Intel { id: string; src: string; tone: Tone; title: string; link?: string; impact: number; tickers: string[]; t: number }

const TONE = {
  bull: { c: "#16e6a4", label: "Bull", Icon: TrendingUp },
  bear: { c: "#ff5a6a", label: "Bear", Icon: TrendingDown },
  neutral: { c: "#9aa3b2", label: "Neutral", Icon: Minus },
} as const;

const SRC_DOT: Record<string, string> = {
  CoinDesk: "#f7a600", "The Block": "#22d3ee", Decrypt: "#a78bfa", Bloomberg: "#ff5a6a",
  Reuters: "#f59e0b", Cointelegraph: "#ffd400", "Watcher.Guru": "#60a5fa", Polymarket: "#34d6ff",
};

/** Shown only if the live news API is unreachable. */
const FALLBACK: Intel[] = [
  { id: "f1", src: "CoinDesk", tone: "bull", title: "Solana DEX volume hits new ATH as memecoin activity surges", impact: 82, tickers: ["SOL"], t: Date.now() - 8 * 60_000 },
  { id: "f2", src: "The Block", tone: "bull", title: "BlackRock files for in-kind redemptions on spot BTC ETF", impact: 74, tickers: ["BTC"], t: Date.now() - 23 * 60_000 },
  { id: "f3", src: "Bloomberg", tone: "bear", title: "Fed minutes signal caution; rate-cut odds slip below 20%", impact: 71, tickers: ["SPX"], t: Date.now() - 60 * 60_000 },
  { id: "f4", src: "Reuters", tone: "neutral", title: "Dollar softens as risk appetite returns to global markets", impact: 40, tickers: ["DXY"], t: Date.now() - 65 * 60_000 },
  { id: "f5", src: "Cointelegraph", tone: "bull", title: "Hyperliquid open interest tops $8B — a record for the perp DEX", impact: 69, tickers: ["HYPE"], t: Date.now() - 90 * 60_000 },
  { id: "f6", src: "Decrypt", tone: "bear", title: "Memecoin index slips 9% as rotation cools off", impact: 55, tickers: ["WIF"], t: Date.now() - 110 * 60_000 },
];

const ageLabel = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  return s < 90 ? "now" : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
};

export function IntelFeed() {
  const [items, setItems] = useState<Intel[]>([]);
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState<Tone | "all">("all");
  const [, force] = useState(0);

  // Real headlines from the backend RSS aggregator; refreshed every 5 min.
  useEffect(() => {
    let on = true;
    const load = () =>
      fetch(`${BACKEND}/api/news`)
        .then((r) => r.json())
        .then((rows: Array<{ src: string; title: string; link: string; t: number; tone: Tone; impact: number; tickers: string[] }>) => {
          if (!on || !Array.isArray(rows) || !rows.length) return;
          setItems(rows.slice(0, 12).map((n) => ({ id: n.link || `${n.src}:${n.t}`, src: n.src, tone: n.tone, title: n.title, link: n.link, impact: n.impact, tickers: n.tickers ?? [], t: n.t })));
          setLive(true);
        })
        .catch(() => { if (on) setItems((prev) => (prev.length ? prev : FALLBACK)); });
    load();
    const iv = setInterval(load, 5 * 60_000);
    const ageTick = setInterval(() => force((x) => x + 1), 30_000); // refresh "Xm ago" labels
    return () => { on = false; clearInterval(iv); clearInterval(ageTick); };
  }, []);

  const net = useMemo(() => {
    const b = items.filter((x) => x.tone === "bull").length;
    const r = items.filter((x) => x.tone === "bear").length;
    return { pct: b + r ? Math.round((b / (b + r)) * 100) : 50 };
  }, [items]);

  const shown = filter === "all" ? items : items.filter((x) => x.tone === filter);

  return (
    <div className="flex h-full flex-col">
      {/* control bar — live pulse + net-sentiment gauge + filters */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-up">
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up/70" /><span className="relative h-1.5 w-1.5 rounded-full bg-up" /></span>
          {live ? "Live · real headlines" : "Connecting…"}
        </span>
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
            const breaking = Date.now() - n.t < 30 * 60_000;
            const dot = SRC_DOT[n.src] ?? "#9aa3b2";
            return (
              <motion.a
                key={n.id}
                href={n.link}
                target="_blank"
                rel="noreferrer"
                layout
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="group relative block overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-2.5 pl-3 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04]"
                style={breaking ? { boxShadow: `0 0 0 1px ${t.c}55, 0 0 22px ${t.c}33` } : undefined}
              >
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: t.c, boxShadow: `0 0 12px ${t.c}` }} />
                <span className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ background: `linear-gradient(90deg, ${t.c}, transparent 60%)` }} />

                <div className="relative mb-1 flex items-center gap-1.5 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
                  <span className="font-bold text-muted">{n.src}</span>
                  <span className="text-faint">· {ageLabel(n.t)}</span>
                  {breaking && <span className="flex items-center gap-0.5 rounded bg-down/20 px-1 text-[8px] font-black uppercase tracking-wider text-down"><Zap size={8} /> New</span>}
                  <span className="ml-auto flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ color: t.c, background: `${t.c}1f` }}>
                    <t.Icon size={10} /> {t.label}
                  </span>
                </div>

                <div className="relative text-[12.5px] font-medium leading-snug text-ink/95">{n.title}</div>

                <div className="relative mt-2 flex items-center gap-2">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-faint">Impact</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full" style={{ width: `${n.impact}%`, background: t.c }} />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums text-muted">{n.impact}</span>
                  {n.tickers.map((tk) => (
                    <span key={tk} className="rounded bg-accent/12 px-1.5 py-0.5 text-[9px] font-bold text-accent">${tk}</span>
                  ))}
                </div>
              </motion.a>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
