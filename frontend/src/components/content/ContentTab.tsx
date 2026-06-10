import { useState } from "react";
import { Radio, Film, TrendingUp, Play } from "lucide-react";
import { compact } from "../../lib/format";
import { BubbleScroll } from "../BubbleScroll";
import { XVodPlayer } from "../XVodPlayer";


/* ── feed: Ansem / Banks / Market Bubble only (demo until an X list is wired) ── */
const FEED = [
  { name: "Ansem", handle: "@blknoiz06", v: 1, text: "sol doing sol things. nothing to see here 🤝", likes: 4200, reposts: 510, views: 312000, d1h: 184, ticker: "SOL", cat: "spiking" },
  { name: "Banks", handle: "@banks", v: 1, text: "going live with ansem this week. it's going to be chaos.", likes: 8900, reposts: 1100, views: 690000, d1h: 58, ticker: "—", cat: "rising" },
  { name: "Market Bubble", handle: "@marketbubble", v: 1, text: "tonight's show 1PM PST — Fed day special with Mike Majlak 🫧", likes: 3300, reposts: 420, views: 198000, d1h: 27, ticker: "—", cat: "active" },
  { name: "Ansem", handle: "@blknoiz06", v: 1, text: "VIRTUAL chart looking like 2021 alt season fractals", likes: 5600, reposts: 690, views: 420000, d1h: 96, ticker: "VIRTUAL", cat: "spiking" },
  { name: "Banks", handle: "@banks", v: 1, text: "the faZe treasury play is more bullish than people realize", likes: 6100, reposts: 740, views: 480000, d1h: 41, ticker: "—", cat: "rising" },
  { name: "Market Bubble", handle: "@marketbubble", v: 1, text: "clip of the day: ansem calling the SOL bottom live 🎯", likes: 2400, reposts: 310, views: 140000, d1h: 33, ticker: "SOL", cat: "active" },
  { name: "Ansem", handle: "@blknoiz06", v: 1, text: "memecoins are the casino and the casino is open 24/7", likes: 7200, reposts: 880, views: 520000, d1h: 62, ticker: "WIF", cat: "rising" },
  { name: "Market Bubble", handle: "@marketbubble", v: 1, text: "$50k Polymarket giveaway stream this weekend. don't miss it.", likes: 4800, reposts: 600, views: 260000, d1h: 48, ticker: "—", cat: "spiking" },
];
const xUrl = (h: string) => `https://x.com/${h.replace(/^@/, "")}`;
const chip = "rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted";

/* Past full episodes — numbered by episode (EP1 = oldest), newest first for display.
 * Real Spotify video episodes; the most recent autoplays in the featured player. */
// Full episodes = the official X broadcast replays (VODs), played in our own
// HLS player via the guest-only /api/x-vod proxy. Newest = highest EP number.
// EP1 only has a highlight clip (no full replay posted), so it has no broadcast id.
const EPISODES: { ep: number; title: string; date: string; duration: string; bid: string | null }[] = [
  { ep: 5, title: "The Dollar Is Going to Zero", date: "Jun 5, 2026", duration: "4h 42m", bid: "1dxYllbQZELJX" },
  { ep: 4, title: "Why Ansem Thinks Ethereum Is Done", date: "May 22, 2026", duration: "2h 54m", bid: "1OxwbldAYLDJB" },
  { ep: 3, title: "How to Get Rich Playing GTA 6", date: "May 15, 2026", duration: "3h 33m", bid: "1DGleEgbRRzJL" },
  { ep: 2, title: "Why AI Is Beating Crypto Right Now", date: "May 8, 2026", duration: "3h 45m", bid: "1DGleEqQkYVJL" },
  { ep: 1, title: "The Truth About Crypto in 2026", date: "May 1, 2026", duration: "1h 6m", bid: null },
];


const FEED_ACCOUNTS = [
  { name: "Ansem", handle: "blknoiz06" },
  { name: "Banks", handle: "Banks" },
  { name: "Market Bubble", handle: "marketbubble" },
];
export function ContentTab() {
  const [feedHandle, setFeedHandle] = useState("all");
  const [vodId, setVodId] = useState<string>(EPISODES[0].bid!); // default = most recent full replay (EP5)
  const topPosts = [...FEED].sort((a, b) => b.views - a.views).slice(0, 6);
  const feedTabs = [{ name: "All", handle: "all" }, ...FEED_ACCOUNTS];

  return (
    <div className="mb-tab">
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      <h1 className="serif text-3xl font-bold tracking-tight sm:text-4xl">Content Radar</h1>
      <p className="mt-1 text-[13px] text-muted">Real-time X feed, trending tickers, the streams that are live, and the clips that pop — all in one place.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* live feed — real X timeline (Ansem / Banks / Market Bubble) */}
        <div className="vc-glass flex flex-col rounded-2xl p-3 lg:col-span-4" style={{ height: 920 }}>
          <div className="mb-2 flex items-center gap-2"><Radio size={14} className="text-down" /><span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Live Feed</span></div>
          <div className="mb-2 flex flex-wrap gap-1">
            {feedTabs.map((a) => (
              <button
                key={a.handle}
                onClick={() => setFeedHandle(a.handle)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${feedHandle === a.handle ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"}`}
              >
                {a.name}
              </button>
            ))}
          </div>
          <BubbleScroll className="flex-1">
            <div className="space-y-2">
              {(feedHandle === "all" ? FEED : FEED.filter((f) => f.handle.replace(/^@/, "").toLowerCase() === feedHandle.toLowerCase())).map((p, i) => (
                <a key={i} href={xUrl(p.handle)} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/8 bg-white/[0.02] p-3 transition hover:border-accent/40 hover:bg-accent/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 text-[11px] font-black text-accent">{p.name[0]}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-bold text-ink">{p.name}</div>
                      <div className="truncate text-[10px] text-faint">{p.handle}</div>
                    </div>
                    {p.ticker !== "—" && <span className="ml-auto shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">${p.ticker}</span>}
                  </div>
                  <p className="mt-2 text-[13px] leading-snug text-ink/90">{p.text}</p>
                  <div className="mt-2 flex items-center gap-4 text-[10px] text-faint">
                    <span>♥ {compact(p.likes)}</span>
                    <span>⟳ {compact(p.reposts)}</span>
                    <span>👁 {compact(p.views)}</span>
                    <span className="ml-auto font-bold text-up">+{p.d1h}% 1h</span>
                  </div>
                </a>
              ))}
            </div>
          </BubbleScroll>
        </div>

        {/* right column */}
        <div className="space-y-4 lg:col-span-8">
          <div className="vc-glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <Film size={14} className="text-accent" />
              <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Full Episodes</span>
              <span className={`${chip}`}>Rewatch</span>
              <a href="https://x.com/MarketBubble" target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-bold text-accent hover:underline">All on X ↗</a>
            </div>

            {/* featured player — autoplays the most recent (or the selected) full episode */}
            <XVodPlayer key={vodId} id={vodId} autoPlay className="aspect-video max-h-[420px] w-full rounded-xl border border-white/10 bg-black object-contain" />

            {/* numbered episode list — click to load into the player above */}
            <div className="mt-3 space-y-1.5">
              {EPISODES.map((e) => {
                const on = e.bid === vodId;
                const noReplay = !e.bid;
                return (
                  <button
                    key={e.ep}
                    disabled={noReplay}
                    onClick={() => e.bid && setVodId(e.bid)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${on ? "border-accent/60 bg-accent/10" : noReplay ? "border-white/8 bg-white/[0.01] opacity-50" : "border-white/8 bg-white/[0.02] hover:border-accent/40"}`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-black ${on ? "bg-accent text-black" : "bg-white/8 text-accent"}`}>{e.ep}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold">{e.title}</span>
                      <span className="block text-[10px] text-faint">EP {e.ep} · {e.date} · {e.duration}</span>
                    </span>
                    {noReplay ? <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-faint">Highlight only</span> : on ? <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-accent">▶ Now playing</span> : <Play size={15} className="shrink-0 text-muted" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="vc-glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-accent" /><span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Top Posts</span><span className={`ml-auto ${chip}`}>most viewed</span></div>
            <div className="space-y-1.5">
              {topPosts.map((p, i) => (
                <a key={i} href={xUrl(p.handle)} target="_blank" rel="noreferrer" className="grid grid-cols-[1.2rem_1fr_auto] items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 transition hover:border-accent/40">
                  <span className="text-[12px] font-bold tabular-nums text-faint">{i + 1}</span>
                  <div className="min-w-0"><span className="text-[12px] font-bold">{p.name}</span> <span className="truncate font-mono text-[10px] text-faint">{p.handle}</span><div className="truncate text-[12px] text-muted">{p.text}</div></div>
                  <div className="text-right"><div className="font-mono text-[12px] font-bold tabular-nums">{compact(p.views)}</div><div className="text-[10px] font-bold text-up">+{p.d1h}% 1h</div></div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-5 text-center text-[11px] text-faint"><span className="font-bold text-up">● Live</span> — full episodes are the real X broadcast replays (guest stream, no login). Watch player &amp; clips are real Twitch; feed &amp; trending are demo until an X tracked-list key is added.</p>
    </div>
    </div>
  );
}
