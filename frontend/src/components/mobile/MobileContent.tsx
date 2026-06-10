import { useState } from "react";
import { MSection, MCard } from "./ui";

/* Past full episodes — numbered by episode (EP1 = oldest), newest first. Real
 * Spotify video episodes; the most recent autoplays in the featured player. */
const SPOTIFY_SHOW = "00yWnJPE80LSBglGwCrjZI";
const EPISODES = [
  { ep: 5, title: "The Dollar Is Going to Zero", date: "Jun 5, 2026", duration: "4h 42m", id: "3tb6qC1wYJ8NzmetLkRHAH" },
  { ep: 4, title: "Why Ansem Thinks Ethereum Is Done", date: "May 22, 2026", duration: "2h 54m", id: "3hyI8cceqmXjns3j87cOio" },
  { ep: 3, title: "How to Get Rich Playing GTA 6", date: "May 15, 2026", duration: "3h 33m", id: "7G0I5apOeMkc7oHepmUj6I" },
  { ep: 2, title: "Why AI Is Beating Crypto Right Now", date: "May 8, 2026", duration: "3h 45m", id: "6FtrBE4TIp3pYip1hHo3XP" },
  { ep: 1, title: "The Truth About Crypto in 2026", date: "May 1, 2026", duration: "1h 6m", id: "0xagf4GYhZvafuupXqFOsM" },
];

/** Mobile Content — past full episodes, rewatchable via the Spotify player. */
export function MobileContent() {
  const [epId, setEpId] = useState(EPISODES[0].id); // default = most recent

  return (
    <div className="pb-6">
      <MSection title="Full Episodes">
        {/* featured player — autoplays the most recent (or selected) episode */}
        <MCard className="overflow-hidden">
          <iframe
            key={epId}
            title="Market Bubble — full episode"
            src={`https://open.spotify.com/embed/episode/${epId}?utm_source=generator&autoplay=1`}
            width="100%"
            height={232}
            frameBorder={0}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </MCard>

        {/* numbered episode list — tap to load above */}
        <div className="mt-3 space-y-2">
          {EPISODES.map((e) => {
            const on = e.id === epId;
            return (
              <button
                key={e.id}
                onClick={() => setEpId(e.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${on ? "border-accent/60 bg-accent/10" : "border-white/8 bg-white/[0.03]"}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-black ${on ? "bg-accent text-black" : "bg-white/8 text-accent"}`}>{e.ep}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{e.title}</span>
                  <span className="block text-[10px] text-muted">EP {e.ep} · {e.date} · {e.duration}</span>
                </span>
                {on && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-accent">▶</span>}
              </button>
            );
          })}
        </div>

        <a href={`https://open.spotify.com/show/${SPOTIFY_SHOW}`} target="_blank" rel="noreferrer" className="mt-3 block text-center text-[12px] font-bold text-accent">All episodes on Spotify ↗</a>
      </MSection>
    </div>
  );
}
