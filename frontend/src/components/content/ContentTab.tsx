import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Radio, Film, TrendingUp, Play } from "lucide-react";
import { compact } from "../../lib/format";
import { BROADCASTS } from "../../store/broadcastStore";
import { BubbleScroll } from "../BubbleScroll";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

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

/** Plays an X broadcast replay (full episode) via the guest HLS proxy — hls.js in
 *  Chrome/Firefox, native HLS in Safari. Falls back to a "Watch on X" link. */
function XVodPlayer({ id, autoPlay }: { id: string; autoPlay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setErr(false);
    let hls: Hls | null = null;
    let dead = false;
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/x-vod/${id}`);
        if (!r.ok) throw new Error("vod");
        const { master } = await r.json();
        const url = `${BACKEND}${master}`;
        const v = ref.current;
        if (!v || dead) return;
        // Set the muted PROPERTY (React's `muted` attr alone won't satisfy Chrome's
        // autoplay policy) and kick play() once ready — hls.js attaches async, so the
        // autoPlay attribute misses it.
        v.muted = !!autoPlay;
        const kick = () => { if (autoPlay) { v.muted = true; v.play().catch(() => {}); } };
        v.addEventListener("canplay", kick, { once: true });
        if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = url;
        } else if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true });
          hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setErr(true); });
          hls.on(Hls.Events.MANIFEST_PARSED, kick);
          hls.loadSource(url);
          hls.attachMedia(v);
        } else {
          setErr(true);
        }
      } catch { setErr(true); }
    })();
    return () => { dead = true; hls?.destroy(); };
  }, [id]);

  if (err) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-xl border border-white/10 bg-black">
        <a href={`https://x.com/i/broadcasts/${id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-bold text-accent hover:bg-accent/25">▶ Watch full replay on X ↗</a>
      </div>
    );
  }
  return <video ref={ref} controls autoPlay={autoPlay} muted={autoPlay} playsInline className="aspect-video w-full rounded-xl border border-white/10 bg-black" />;
}

interface Clip { id: string; title: string; viewCount?: number; thumbnail?: string }
interface Channel { live: boolean; vods: { id: string }[]; clips: Clip[] }

function AnsemStream({ login }: { login: string }) {
  const [ch, setCh] = useState<Channel | null>(null);
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => { setHost(location.hostname); fetch(`${BACKEND}/api/twitch/channel/${login}`).then((r) => r.json()).then(setCh).catch(() => setCh({ live: false, vods: [], clips: [] })); }, [login]);

  const isLive = !!ch?.live;
  const liveSrc = host ? `https://player.twitch.tv/?channel=${login}&parent=${host}&muted=true` : null;
  const broadcast = BROADCASTS[0]; // most recent Market Bubble broadcast
  return (
    <>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
        {isLive && liveSrc
          ? <iframe key={liveSrc} src={liveSrc} title={login} allow="autoplay; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full" />
          : <video key={broadcast.src} src={`${broadcast.src}#t=2`} controls preload="metadata" playsInline className="absolute inset-0 h-full w-full object-cover" />}
        <span className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase backdrop-blur ${isLive ? "bg-down/25 text-down" : "bg-black/55 text-accent"}`}>{isLive ? "Ansem Live" : "Latest Broadcast"}</span>
      </div>
      {!isLive && (
        <p className="mt-2 text-[12px] font-semibold">{broadcast.title} <span className="font-normal text-faint">· {broadcast.date} · {broadcast.duration}</span></p>
      )}
    </>
  );
}

const FEED_ACCOUNTS = [
  { name: "Ansem", handle: "blknoiz06" },
  { name: "Banks", handle: "Banks" },
  { name: "Market Bubble", handle: "marketbubble" },
];
/** Public X List id of the 3 accounts → a single time-interleaved "All" feed.
 *  Empty = fall back to stacking each account's recent tweets. */
const FEED_LIST_ID = "";

/** Embedded X (Twitter) timeline — real recent tweets; clicking opens the tweet.
 *  Pass `handle` for one profile, or `list` for a List (interleaved). */
function XTimeline({ handle, list, limit = 12 }: { handle?: string; list?: string; limit?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const href = list ? `https://twitter.com/i/lists/${list}` : `https://twitter.com/${handle}`;
    el.innerHTML = `<a class="twitter-timeline" data-theme="dark" data-chrome="noheader nofooter noborders transparent" data-tweet-limit="${limit}" href="${href}">Tweets</a>`;
    const w = window as unknown as { twttr?: { widgets: { load: (e?: HTMLElement) => void } } };
    if (w.twttr?.widgets) {
      w.twttr.widgets.load(el);
    } else if (!document.getElementById("twttr-wjs")) {
      const s = document.createElement("script");
      s.id = "twttr-wjs";
      s.src = "https://platform.twitter.com/widgets.js";
      s.async = true;
      document.body.appendChild(s);
    } else {
      const iv = setInterval(() => { const ww = (window as unknown as { twttr?: { widgets: { load: (e?: HTMLElement) => void } } }).twttr; if (ww?.widgets) { ww.widgets.load(el); clearInterval(iv); } }, 300);
      setTimeout(() => clearInterval(iv), 6000);
    }
  }, [handle, list, limit]);
  return <div ref={ref} />;
}

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
            {feedHandle === "all" ? (
              FEED_LIST_ID ? (
                <XTimeline list={FEED_LIST_ID} limit={20} />
              ) : (
                FEED_ACCOUNTS.map((a) => (
                  <div key={a.handle} className="mb-4">
                    <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-faint">{a.name}</div>
                    <XTimeline handle={a.handle} limit={5} />
                  </div>
                ))
              )
            ) : (
              <XTimeline key={feedHandle} handle={feedHandle} limit={14} />
            )}
          </BubbleScroll>
        </div>

        {/* right column */}
        <div className="space-y-4 lg:col-span-8">
          <div className="vc-glass flex flex-col rounded-2xl p-3">
            <div className="mb-2 flex items-center gap-2"><Play size={13} className="text-accent" /><span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Watch · Ansem</span></div>
            <AnsemStream login="blknoiz06" />
          </div>

          <div className="vc-glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <Film size={14} className="text-accent" />
              <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Full Episodes</span>
              <span className={`${chip}`}>Rewatch</span>
              <a href="https://x.com/MarketBubble" target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-bold text-accent hover:underline">All on X ↗</a>
            </div>

            {/* featured player — autoplays the most recent (or the selected) full episode */}
            <XVodPlayer key={vodId} id={vodId} autoPlay />

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
