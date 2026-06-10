import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { MSection, MCard } from "./ui";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

/* Past full episodes = the official X broadcast replays (VODs), played via the
 * guest-only /api/x-vod proxy. Newest = highest EP number; EP1 has only a
 * highlight clip (no full replay), so no broadcast id. */
const EPISODES: { ep: number; title: string; date: string; duration: string; bid: string | null }[] = [
  { ep: 5, title: "The Dollar Is Going to Zero", date: "Jun 5, 2026", duration: "4h 42m", bid: "1dxYllbQZELJX" },
  { ep: 4, title: "Why Ansem Thinks Ethereum Is Done", date: "May 22, 2026", duration: "2h 54m", bid: "1OxwbldAYLDJB" },
  { ep: 3, title: "How to Get Rich Playing GTA 6", date: "May 15, 2026", duration: "3h 33m", bid: "1DGleEgbRRzJL" },
  { ep: 2, title: "Why AI Is Beating Crypto Right Now", date: "May 8, 2026", duration: "3h 45m", bid: "1DGleEqQkYVJL" },
  { ep: 1, title: "The Truth About Crypto in 2026", date: "May 1, 2026", duration: "1h 6m", bid: null },
];

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
        if (autoPlay) v.addEventListener("canplay", () => v.play().catch(() => {}), { once: true });
        if (v.canPlayType("application/vnd.apple.mpegurl")) v.src = url;
        else if (Hls.isSupported()) { hls = new Hls({ enableWorker: true }); hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setErr(true); }); hls.loadSource(url); hls.attachMedia(v); }
        else setErr(true);
      } catch { setErr(true); }
    })();
    return () => { dead = true; hls?.destroy(); };
  }, [id]);
  if (err) return (
    <div className="grid aspect-video w-full place-items-center bg-black">
      <a href={`https://x.com/i/broadcasts/${id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-accent/50 bg-accent/15 px-3 py-1.5 text-[12px] font-bold text-accent">▶ Watch on X ↗</a>
    </div>
  );
  return <video ref={ref} controls autoPlay={autoPlay} muted={autoPlay} playsInline className="aspect-video w-full bg-black" />;
}

/** Mobile Content — past full episodes, rewatchable via the X replay player. */
export function MobileContent() {
  const [vodId, setVodId] = useState<string>(EPISODES[0].bid!); // most recent full replay

  return (
    <div className="pb-6">
      <MSection title="Full Episodes">
        {/* featured player — autoplays the most recent (or selected) full episode */}
        <MCard className="overflow-hidden">
          <XVodPlayer key={vodId} id={vodId} autoPlay />
        </MCard>

        {/* numbered episode list — tap to load above */}
        <div className="mt-3 space-y-2">
          {EPISODES.map((e) => {
            const on = e.bid === vodId;
            const noReplay = !e.bid;
            return (
              <button
                key={e.ep}
                disabled={noReplay}
                onClick={() => e.bid && setVodId(e.bid)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${on ? "border-accent/60 bg-accent/10" : noReplay ? "border-white/8 bg-white/[0.01] opacity-50" : "border-white/8 bg-white/[0.03]"}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-black ${on ? "bg-accent text-black" : "bg-white/8 text-accent"}`}>{e.ep}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{e.title}</span>
                  <span className="block text-[10px] text-muted">EP {e.ep} · {e.date} · {e.duration}</span>
                </span>
                {noReplay ? <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-faint">Highlight</span> : on ? <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-accent">▶</span> : null}
              </button>
            );
          })}
        </div>

        <a href="https://x.com/MarketBubble" target="_blank" rel="noreferrer" className="mt-3 block text-center text-[12px] font-bold text-accent">All episodes on X ↗</a>
      </MSection>
    </div>
  );
}
