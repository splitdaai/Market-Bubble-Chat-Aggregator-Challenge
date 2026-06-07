import { useEffect, useRef, useState } from "react";
import { Radio, Film, TrendingUp, Play } from "lucide-react";
import { compact } from "../../lib/format";
import { BROADCASTS } from "../../store/broadcastStore";

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
  const topPosts = [...FEED].sort((a, b) => b.views - a.views).slice(0, 6);
  const feedTabs = [{ name: "All", handle: "all" }, ...FEED_ACCOUNTS];

  return (
    <div className="mb-tab">
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      <h1 className="serif text-3xl font-bold tracking-tight sm:text-4xl">Content Radar</h1>
      <p className="mt-1 text-[13px] text-muted">Real-time X feed, trending tickers, the streams that are live, and the clips that pop — all in one place.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* live feed — real X timeline (Ansem / Banks / Market Bubble) */}
        <div className="vc-glass flex flex-col rounded-2xl p-3 lg:col-span-4" style={{ height: 760 }}>
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
          <div className="scroll min-h-0 flex-1 overflow-y-auto pr-1">
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
          </div>
        </div>

        {/* right column */}
        <div className="space-y-4 lg:col-span-8">
          <div className="vc-glass flex flex-col rounded-2xl p-3">
            <div className="mb-2 flex items-center gap-2"><Play size={13} className="text-accent" /><span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Watch · Ansem</span></div>
            <AnsemStream login="blknoiz06" />
          </div>

          <div className="vc-glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2"><Film size={14} className="text-accent" /><span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Full Episodes</span><span className={`ml-auto ${chip}`}>Market Bubble</span></div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {BROADCASTS.map((b) => (
                <a key={b.id} href={b.src} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] transition hover:border-accent/50">
                  <div className="relative aspect-video w-full bg-black">
                    <video src={`${b.src}#t=2`} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-85 transition group-hover:opacity-100"><Play size={22} className="text-white drop-shadow" /></span>
                    <span className={`absolute left-1 top-1 rounded px-1 text-[8px] font-black uppercase tracking-wide ${b.live ? "bg-down/80 text-white" : "bg-black/70 text-accent"}`}>{b.live ? "● Live" : "Episode"}</span>
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold tabular-nums">{b.duration}</span>
                    <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1 text-[8px] font-bold text-muted">Market Bubble</span>
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="truncate text-[11px] font-semibold">{b.title}</div>
                    <div className="text-[9px] text-faint">{b.date}</div>
                  </div>
                </a>
              ))}
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
      <p className="mt-5 text-center text-[11px] text-faint"><span className="font-bold text-up">● Live</span> — the Watch player &amp; clips are real (Twitch via backend). Feed &amp; trending are demo until an X tracked-list key is added.</p>
    </div>
    </div>
  );
}
