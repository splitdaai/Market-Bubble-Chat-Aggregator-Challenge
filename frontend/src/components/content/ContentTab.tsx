import { useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Repeat2, Heart, BarChart3, Play, Flame } from "lucide-react";
import { compact } from "../../lib/format";

/* ── Top tweets ("On X") ────────────────────────────────────────────────── */
const FEED = [
  { name: "Market Bubble", handle: "@marketbubble", text: "Ansem is up +450% in two weeks, leading the Bullpen comp by ~$100k. $25K → $137K, every trade called live on the show.", likes: 9800, reposts: 1400, views: 720000, time: "2h" },
  { name: "Banks", handle: "@banks", text: "going live with ansem this week. it's going to be chaos.", likes: 8900, reposts: 1100, views: 690000, time: "8m" },
  { name: "Ansem", handle: "@blknoiz06", text: "memecoins are the casino and the casino is open 24/7", likes: 7200, reposts: 880, views: 520000, time: "1h" },
  { name: "Banks", handle: "@banks", text: "the faZe treasury play is more bullish than people realize", likes: 6100, reposts: 740, views: 480000, time: "31m" },
  { name: "Ansem", handle: "@blknoiz06", text: "VIRTUAL chart looking like 2021 alt season fractals", likes: 5600, reposts: 690, views: 420000, time: "23m" },
  { name: "Ansem", handle: "@blknoiz06", text: "sol doing sol things. nothing to see here 🤝", likes: 4200, reposts: 510, views: 312000, time: "2m" },
];
const xUrl = (h: string) => `https://x.com/${h.replace(/^@/, "")}`;

/* ── Full episodes (the actual content videos) ──────────────────────────── */
const EPISODES: { ep: number; title: string; date: string; duration: string; views: string; bid: string | null }[] = [
  { ep: 5, title: "The Dollar Is Going to Zero", date: "Jun 5, 2026", duration: "4h 42m", views: "83K", bid: "1dxYllbQZELJX" },
  { ep: 4, title: "Why Ansem Thinks Ethereum Is Done", date: "May 22, 2026", duration: "2h 54m", views: "144K", bid: "1OxwbldAYLDJB" },
  { ep: 3, title: "How to Get Rich Playing GTA 6", date: "May 15, 2026", duration: "3h 33m", views: "40K", bid: "1DGleEgbRRzJL" },
  { ep: 2, title: "Why AI Is Beating Crypto Right Now", date: "May 8, 2026", duration: "3h 45m", views: "173K", bid: "1DGleEqQkYVJL" },
  { ep: 1, title: "The Truth About Crypto in 2026", date: "May 1, 2026", duration: "1h 6m", views: "228K", bid: null },
];

const STATS = [
  { v: "1.9M", l: "combined reach" },
  { v: "5", l: "episodes" },
  { v: "16h", l: "streamed" },
  { v: "4", l: "platforms" },
];

/** Real X profile picture (via unavatar) with a colored-initial fallback. */
function XAvatar({ handle, name, size = 44 }: { handle: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const h = handle.replace(/^@/, "");
  if (err) return <span className="grid shrink-0 place-items-center rounded-full bg-accent/15 font-black text-accent" style={{ height: size, width: size, fontSize: size * 0.34 }}>{name[0]}</span>;
  return <img src={`https://unavatar.io/twitter/${h}`} alt={name} onError={() => setErr(true)} className="shrink-0 rounded-full bg-white/5 object-cover" style={{ height: size, width: size }} />;
}

/** The X logo glyph. */
function XLogo({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** Editorial section rule — serif heading left, meta right, hairline under. */
function SectionRule({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-5 mt-12 flex items-baseline justify-between gap-4 border-b border-white/12 pb-2.5">
      <h2 className="serif flex items-center gap-2.5 text-[24px] font-bold italic leading-none text-ink sm:text-[28px]">
        <span className="inline-block h-5 w-1 rounded-full bg-accent" /> {title}
      </h2>
      {meta && <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{meta}</span>}
    </div>
  );
}

export function ContentTab() {
  const [vodId, setVodId] = useState<string>(EPISODES[0].bid!);
  const featured = EPISODES.find((e) => e.bid === vodId) ?? EPISODES[0];
  const watchHref = featured.bid ? `https://x.com/i/broadcasts/${featured.bid}` : "https://x.com/MarketBubble";

  return (
    <div className="mb-tab mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
      {/* masthead */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-white/12 pb-4">
        <div>
          <h1 className="serif text-[2.75rem] font-bold leading-none tracking-tight sm:text-[3.5rem]">Content</h1>
          <p className="mt-2.5 max-w-xl text-[14px] text-muted">The latest from the show — the episodes, the moments, and what the timeline is saying.</p>
        </div>
        <div className="mb-1 flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          {STATS.map((s) => (
            <span key={s.l} className="flex items-baseline gap-1.5">
              <span className="serif text-[18px] font-bold not-italic text-ink">{s.v}</span> {s.l}
            </span>
          ))}
        </div>
      </div>

      {/* ── THE COVER — clean live preview on top, title band below ─────── */}
      <div className="mt-6 overflow-hidden rounded-[20px] border border-white/12 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.95)]">
        {/* preview — the clip carries its own on-screen graphics, so we keep it
            clean (no overlay) and let our title live in the band beneath it */}
        <div className="relative aspect-[2.4/1] w-full bg-black">
          <video src="/stream-preview.mp4" autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 28%" }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--vc-bg)] to-transparent" />
        </div>
        {/* title band */}
        <div className="flex flex-col gap-3 border-t border-white/10 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7" style={{ background: "color-mix(in srgb, var(--vc-bg) 86%, #fff 4%)" }}>
          <div>
            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-accent">
              <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-accent/70" /><span className="relative h-2 w-2 rounded-full bg-accent" /></span>
              Latest episode
            </span>
            <h2 className="serif mt-2 max-w-[20ch] text-[2.1rem] font-bold uppercase leading-[0.98] text-ink sm:text-[3.1rem]">{featured.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[featured.date, featured.duration, `${featured.views} views`].map((m) => (
                <span key={m} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[12px] font-semibold text-muted">{m}</span>
              ))}
            </div>
          </div>
          <a href={watchHref} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-[var(--vc-bg)] transition hover:brightness-110 sm:self-end">
            <Play size={15} /> Watch full replay on X
          </a>
        </div>
      </div>

      {/* ── TOP TWEETS — a clean list ──────────────────────────────────── */}
      <SectionRule title="Top Tweets" meta={<a href="https://x.com/MarketBubble" target="_blank" rel="noreferrer" className="transition hover:text-accent">On X ↗</a>} />
      <div className="overflow-hidden rounded-2xl border border-white/10">
        {FEED.map((p, i) => (
          <a
            key={i}
            href={xUrl(p.handle)}
            target="_blank"
            rel="noreferrer"
            className={`flex gap-3.5 px-4 py-3.5 transition hover:bg-white/[0.03] ${i > 0 ? "border-t border-white/8" : ""}`}
          >
            <XAvatar handle={p.handle} name={p.name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13px]">
                <span className="truncate font-bold text-ink">{p.name}</span>
                <BadgeCheck size={14} className="shrink-0 text-[#1d9bf0]" />
                <span className="truncate text-muted">{p.handle}</span>
                <span className="shrink-0 text-faint">· {p.time}</span>
                {i === 0 && <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-accent"><Flame size={10} /> Top</span>}
                <XLogo className="ml-auto h-3.5 w-3.5 shrink-0 text-muted" />
              </div>
              <p className="mt-0.5 text-[14px] leading-snug text-ink">{p.text}</p>
              <div className="mt-2 flex items-center gap-5 text-[12px] text-muted">
                <span className="flex items-center gap-1.5"><Repeat2 size={14} /> {compact(p.reposts)}</span>
                <span className="flex items-center gap-1.5"><Heart size={13} /> {compact(p.likes)}</span>
                <span className="flex items-center gap-1.5"><BarChart3 size={13} /> {compact(p.views)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* ── EPISODES — the actual content videos ───────────────────────── */}
      <SectionRule title="Episodes" meta="All on X ↗" />
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {EPISODES.map((e) => {
          const on = e.bid === vodId;
          const noReplay = !e.bid;
          return (
            <motion.button
              key={e.ep}
              disabled={noReplay}
              onClick={() => e.bid && setVodId(e.bid)}
              whileHover={noReplay ? undefined : { y: -4 }}
              className={`group/ep flex flex-col overflow-hidden rounded-2xl border text-left transition-colors ${on ? "border-accent/60" : noReplay ? "border-white/8 opacity-55" : "border-white/10 hover:border-accent/40"}`}
            >
              <div className="relative aspect-video overflow-hidden" style={{ background: "radial-gradient(130% 130% at 70% 0%, color-mix(in srgb, var(--vc-accent) 18%, transparent), transparent 55%), linear-gradient(150deg, color-mix(in srgb, var(--vc-bg) 55%, #000), var(--vc-bg))" }}>
                <span className="serif absolute -bottom-4 right-2 text-[6rem] font-black leading-none text-white/[0.06]">{e.ep}</span>
                <span className="absolute left-2.5 top-2.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/90 backdrop-blur">{e.duration}</span>
                {on ? (
                  <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--vc-bg)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--vc-bg)]" /> On cover</span>
                ) : noReplay ? (
                  <span className="absolute right-2.5 top-2.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70 backdrop-blur">Highlight</span>
                ) : (
                  <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover/ep:opacity-100">
                    <span className="grid h-12 w-12 place-items-center rounded-full border border-white/70 bg-black/50 text-white"><Play size={20} className="ml-0.5" /></span>
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-accent/80">Episode {e.ep}</span>
                <span className="serif text-[15px] font-bold leading-tight text-ink">{e.title}</span>
                <span className="mt-auto pt-1 text-[11px] text-faint">{e.date} · {e.views} views</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="mt-12 text-center text-[11px] text-faint">Full episodes are the real X broadcast replays (guest stream, no login). Tweets &amp; stats are demo until an X tracked-list key is added.</p>
    </div>
  );
}
