import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame, Zap, TrendingUp, ExternalLink, Monitor, Search, RefreshCw } from "lucide-react";
import { fetchMarkets, breakingFrom, fmtVol, POLY_CATEGORIES, MOCK_MARKETS, type PolyMarket } from "@/lib/polymarket";
import { useOverlayStore } from "@/store/overlayStore";
import { useToastStore } from "@/store/toastStore";

type View = "trending" | "breaking" | "all" | "other" | (typeof POLY_CATEGORIES)[number];

/**
 * Live Polymarket panel — top trending + breaking quick views plus a category
 * dropdown that browses every market. Click any market to pin it to the OBS
 * overlay.
 */
export function PolymarketPanel() {
  const addMarket = useOverlayStore((s) => s.addMarket);
  const push = useToastStore((s) => s.push);
  const [view, setView] = useState<View>("trending");
  const [q, setQ] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["polymarket"],
    queryFn: fetchMarkets,
    staleTime: 60_000,
    refetchInterval: 90_000,
  });

  const markets = isError || !data?.length ? MOCK_MARKETS : data;
  const breaking = useMemo(() => breakingFrom(markets), [markets]);

  // Market count per category (so the dropdown shows every category + its size).
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of markets) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [markets]);

  const list = useMemo(() => {
    let rows: PolyMarket[];
    if (view === "trending") rows = [...markets].sort((a, b) => b.volume24h - a.volume24h);
    else if (view === "breaking") rows = breaking;
    else if (view === "all") rows = [...markets].sort((a, b) => b.volume24h - a.volume24h);
    else rows = markets.filter((m) => m.category === view).sort((a, b) => b.volume24h - a.volume24h);
    const needle = q.trim().toLowerCase();
    if (needle) rows = rows.filter((m) => m.question.toLowerCase().includes(needle) || m.outcome.toLowerCase().includes(needle));
    return rows;
  }, [markets, view, breaking, q]);

  const pin = (m: PolyMarket) => {
    addMarket({ id: m.id, question: m.question, outcome: m.outcome, prob: m.prob, volume24h: m.volume24h, category: m.category });
    push({ message: `Pinned to overlay · ${m.question.slice(0, 40)}…`, tone: "ok" });
  };

  return (
    <div className="flex h-full flex-col p-3">
      {/* header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-accent/15 text-[10px] font-black text-accent">P</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Polymarket</span>
          {isError && <span className="text-[9px] font-semibold text-amber-300">· demo</span>}
        </div>
        <button onClick={() => refetch()} title="Refresh markets" className="rounded p-1 text-muted transition hover:text-accent">
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* quick views + category dropdown */}
      <div className="mb-2 flex items-center gap-1.5">
        <button
          onClick={() => setView("trending")}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
            view === "trending" ? "border-accent/60 bg-accent/15 text-accent" : "border-white/10 text-muted hover:text-ink"
          }`}
        >
          <Flame size={12} /> Trending
        </button>
        <button
          onClick={() => setView("breaking")}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
            view === "breaking" ? "border-accent/60 bg-accent/15 text-accent" : "border-white/10 text-muted hover:text-ink"
          }`}
        >
          <Zap size={12} /> Breaking
        </button>
        <select
          value={view === "trending" || view === "breaking" ? "" : view}
          onChange={(e) => setView((e.target.value || "all") as View)}
          className={`ml-auto rounded-lg border bg-black/40 px-2 py-1.5 text-[11px] font-bold capitalize outline-none focus:border-accent ${
            view !== "trending" && view !== "breaking" ? "border-accent text-accent" : "border-white/10 text-muted"
          }`}
          title="Browse by category"
        >
          <option value="">Categories…</option>
          <option value="all">All Markets ({markets.length})</option>
          {POLY_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c} ({counts[c] ?? 0})</option>
          ))}
          {(counts.other ?? 0) > 0 && <option value="other">other ({counts.other})</option>}
        </select>
      </div>

      {/* search */}
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5">
        <Search size={13} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search markets…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>

      {/* list */}
      <div className="vc-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {isLoading ? (
          <div className="grid h-full place-items-center text-[11px] text-muted opacity-70">Loading markets…</div>
        ) : list.length === 0 ? (
          <div className="grid h-full place-items-center text-[11px] text-muted opacity-70">No markets here</div>
        ) : (
          list.map((m) => {
            const yes = Math.round(m.prob * 100);
            const no = 100 - yes;
            return (
              <button
                key={m.id}
                onClick={() => pin(m)}
                title="Click to pin to the OBS overlay"
                className="group flex flex-col gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-2 text-left transition hover:border-accent/40 hover:bg-accent/[0.05]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-[13px] font-bold leading-tight text-ink">{m.question}</span>
                  <span className="shrink-0 truncate text-[11px] font-semibold text-ink/70" style={{ maxWidth: 90 }}>{m.outcome}</span>
                </div>
                {/* yes / no split bar (green / red, like Polymarket) */}
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/8">
                  <div className="h-full bg-emerald-500" style={{ width: `${yes}%` }} />
                  <div className="h-full bg-red-500" style={{ width: `${no}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                  <span className="text-emerald-400">Yes {yes}%</span>
                  <span className="text-red-400">No {no}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span className="rounded bg-white/8 px-1 py-0.5 font-bold uppercase tracking-wider">{m.category}</span>
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5 tabular-nums"><TrendingUp size={9} /> {fmtVol(m.volume24h)}</span>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted transition hover:text-accent"
                      title="Open on Polymarket"
                    >
                      <ExternalLink size={11} />
                    </a>
                    <Monitor size={12} className="text-muted opacity-0 transition group-hover:opacity-100 group-hover:text-accent" />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
      <p className="mt-1.5 shrink-0 text-center text-[9px] text-muted opacity-60">Click a market to pin it to the OBS overlay</p>
    </div>
  );
}
