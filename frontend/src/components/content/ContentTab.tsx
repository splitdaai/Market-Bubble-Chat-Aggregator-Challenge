import { useEffect, useRef, useState } from "react";
import { Radio, Film, Eye, Flame, TrendingUp, Play, Clapperboard, Heart, Repeat2, BadgeCheck } from "lucide-react";
import { compact } from "../../lib/format";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

/* ── demo feed data (an X tracked-list wires this to real posts) ── */
const FEED = [
  { name: "Ansem", handle: "@blknoiz06", v: 1, text: "sol doing sol things. nothing to see here 🤝", likes: 4200, reposts: 510, views: 312000, d1h: 184, ticker: "SOL", cat: "spiking" },
  { name: "Cupsey", handle: "@Cupseyy", v: 0, text: "$PNUT just went vertical. who's still doubting the peanut 🥜", likes: 1800, reposts: 240, views: 88000, d1h: 320, ticker: "PNUT", cat: "spiking" },
  { name: "Cobie", handle: "@cobie", v: 1, text: "everyone bullish = nobody left to buy. just saying.", likes: 9800, reposts: 1200, views: 740000, d1h: 64, ticker: "BTC", cat: "rising" },
  { name: "Hsaka", handle: "@HsakaTrades", v: 1, text: "memecoin rotation is brutal but the trend is your friend until it ends", likes: 3100, reposts: 280, views: 210000, d1h: 41, ticker: "WIF", cat: "rising" },
  { name: "GCR", handle: "@GiganticRebirth", v: 1, text: "the leverage in this market is getting silly again. be careful out there.", likes: 6400, reposts: 720, views: 410000, d1h: 28, ticker: "HYPE", cat: "active" },
  { name: "Will Clemente", handle: "@WClementeIII", v: 1, text: "on-chain data showing long-term holders still not selling. supply squeeze building.", likes: 5200, reposts: 610, views: 380000, d1h: 33, ticker: "BTC", cat: "rising" },
  { name: "Frank", handle: "@frankdegods", v: 1, text: "solana culture coins are the only thing trading with conviction rn", likes: 4100, reposts: 380, views: 256000, d1h: 19, ticker: "BONK", cat: "active" },
  { name: "Ansem", handle: "@blknoiz06", v: 1, text: "VIRTUAL chart looking like 2021 alt season fractals", likes: 5600, reposts: 690, views: 420000, d1h: 96, ticker: "VIRTUAL", cat: "spiking" },
];
const TRENDING = [
  { tag: "$PNUT", mentions: 4210, views: 1.2e6, d1h: 312 }, { tag: "$VIRTUAL", mentions: 3870, views: 980000, d1h: 184 },
  { tag: "AI agents", mentions: 2960, views: 1.4e6, d1h: 96 }, { tag: "$HYPE", mentions: 2510, views: 760000, d1h: 73 },
  { tag: "$SOL", mentions: 8800, views: 3.1e6, d1h: 41 }, { tag: "$BTC", mentions: 12400, views: 5.4e6, d1h: 14 },
];
const xUrl = (h: string) => `https://x.com/${h.replace(/^@/, "")}`;
const chip = "rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted";

interface Clip { id: string; title: string; viewCount?: number; thumbnail?: string }
interface Channel { live: boolean; vods: { id: string }[]; clips: Clip[] }

function AnsemStream({ login }: { login: string }) {
  const [ch, setCh] = useState<Channel | null>(null);
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => { setHost(location.hostname); fetch(`${BACKEND}/api/twitch/channel/${login}`).then((r) => r.json()).then(setCh).catch(() => setCh({ live: false, vods: [], clips: [] })); }, [login]);

  let src: string | null = null, label = "Offline", live = false;
  if (host && ch) {
    if (ch.live) { src = `https://player.twitch.tv/?channel=${login}&parent=${host}&muted=true`; label = "Live"; live = true; }
    else if (ch.vods?.[0]) { src = `https://player.twitch.tv/?video=${ch.vods[0].id}&parent=${host}&muted=true`; label = "Latest broadcast"; }
    else if (ch.clips?.[0]) { src = `https://clips.twitch.tv/embed?clip=${ch.clips[0].id}&parent=${host}`; label = "Latest clip"; }
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
      {src ? <iframe key={src} src={src} title={login} allow="autoplay; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full" />
        : <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-accent/15 to-black"><Play size={28} /></div>}
      <span className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase backdrop-blur ${live ? "bg-down/25 text-down" : "bg-black/55 text-accent"}`}>{label}</span>
    </div>
  );
}

export function ContentTab() {
  const [posts, setPosts] = useState(() => FEED.map((p, i) => ({ ...p, id: i })));
  const idx = useRef(FEED.length);
  const [videos, setVideos] = useState<(Clip & { channel: string; author: string })[]>([]);

  useEffect(() => {
    const t = setInterval(() => { const s = FEED[idx.current % FEED.length]; idx.current++; setPosts((c) => [{ ...s, id: idx.current, text: s.text }, ...c].slice(0, 30)); }, 2200);
    Promise.all([fetch(`${BACKEND}/api/twitch/channel/blknoiz06`).then((r) => r.json()), fetch(`${BACKEND}/api/twitch/channel/banks`).then((r) => r.json())])
      .then(([a, b]) => setVideos([
        ...((a.clips ?? []).map((c: Clip) => ({ ...c, channel: "blknoiz06", author: "Ansem" }))),
        ...((b.clips ?? []).map((c: Clip) => ({ ...c, channel: "banks", author: "BanKs" }))),
      ].filter((c) => c.thumbnail).sort((x, y) => (y.viewCount ?? 0) - (x.viewCount ?? 0)).slice(0, 6)))
      .catch(() => {});
    return () => clearInterval(t);
  }, []);

  const topPosts = [...FEED].sort((a, b) => b.views - a.views).slice(0, 6);

  return (
    <div className="mb-tab">
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      <h1 className="serif text-3xl font-bold tracking-tight sm:text-4xl">Content Radar</h1>
      <p className="mt-1 text-[13px] text-muted">Real-time X feed, trending tickers, the streams that are live, and the clips that pop — all in one place.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* live feed */}
        <div className="vc-glass flex flex-col rounded-2xl p-3 lg:col-span-4" style={{ height: 760 }}>
          <div className="mb-2 flex items-center gap-2"><Radio size={14} className="text-down" /><span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Live Feed</span></div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {posts.map((p) => (
              <a key={p.id} href={xUrl(p.handle)} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/8 bg-white/[0.02] p-2.5 transition hover:border-accent/40">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/8 text-[11px] font-bold">{p.name[0]}</span>
                  <span className="truncate text-[13px] font-bold">{p.name}</span>
                  {p.v ? <BadgeCheck size={13} className="shrink-0 text-accent" /> : null}
                  <span className="truncate font-mono text-[11px] text-faint">{p.handle}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-snug">{p.text}</p>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-faint">
                  {p.ticker !== "—" && <span className="rounded bg-accent/12 px-1.5 py-0.5 font-bold text-accent">{p.ticker}</span>}
                  <span className="flex items-center gap-1"><Eye size={11} /> {compact(p.views)}</span>
                  <span className="flex items-center gap-1"><Heart size={11} /> {compact(p.likes)}</span>
                  <span className="flex items-center gap-1"><Repeat2 size={11} /> {compact(p.reposts)}</span>
                  <span className="ml-auto flex items-center gap-0.5 font-bold text-up"><TrendingUp size={11} /> +{p.d1h}% 1h</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* right column */}
        <div className="space-y-4 lg:col-span-8">
          <div className="vc-glass flex flex-col rounded-2xl p-3">
            <div className="mb-2 flex items-center gap-2"><Play size={13} className="text-accent" /><span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Watch · Ansem</span></div>
            <AnsemStream login="blknoiz06" />
          </div>

          <div className="vc-glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2"><Flame size={14} className="text-down" /><span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Trending</span><span className={`ml-auto ${chip}`}>by 1h Δ</span></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TRENDING.map((t, i) => (
                <a key={t.tag} href={`https://x.com/search?q=${encodeURIComponent(t.tag)}&f=live`} target="_blank" rel="noreferrer" className="block rounded-lg border border-white/8 bg-white/[0.02] p-2.5 transition hover:border-accent/40">
                  <div className="flex items-center gap-1.5"><span className="text-[11px] font-bold tabular-nums text-faint">{i + 1}</span><span className="truncate text-[13px] font-bold">{t.tag}</span></div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-faint"><span className="flex items-center gap-0.5"><Eye size={10} /> {compact(t.views)}</span><span className="ml-auto font-bold text-up">+{t.d1h}%</span></div>
                </a>
              ))}
            </div>
          </div>

          <div className="vc-glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2"><Film size={14} className="text-accent" /><span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Trending Videos</span></div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {videos.map((v, i) => (
                <a key={i} href={`https://clips.twitch.tv/${v.id}`} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] transition hover:border-accent/50">
                  <div className="relative aspect-video w-full bg-gradient-to-br from-black to-accent/15">
                    {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : null}
                    <span className="absolute inset-0 grid place-items-center bg-black/15 opacity-70 group-hover:opacity-100"><Clapperboard size={20} className="text-white" /></span>
                    <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/70 px-1 text-[9px] font-bold"><Eye size={8} /> {compact(v.viewCount ?? 0)}</span>
                    <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[8px] font-bold text-muted">{v.author}</span>
                  </div>
                  <div className="truncate px-2 py-1.5 text-[11px] font-semibold">{v.title}</div>
                </a>
              ))}
              {!videos.length && <div className="col-span-full py-6 text-center text-[12px] text-faint">Loading clips…</div>}
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
