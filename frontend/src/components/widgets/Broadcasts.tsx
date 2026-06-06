import { Play, Radio, Clock } from "lucide-react";
import { useTwitchStore } from "@/store/twitchStore";
import { usePreviewStore } from "@/store/previewStore";
import { useToastStore } from "@/store/toastStore";

/** Banks' real Twitch broadcasts — the live channel + archived VODs. Click one
 *  to play it (embedded) in the Stream Preview. */
export function Broadcasts() {
  const login = useTwitchStore((s) => s.login);
  const live = useTwitchStore((s) => s.live);
  const vods = useTwitchStore((s) => s.vods);
  const nowPlaying = useTwitchStore((s) => s.nowPlaying);
  const play = useTwitchStore((s) => s.play);
  const previewHidden = usePreviewStore((s) => s.hidden);
  const showPreview = usePreviewStore((s) => s.toggle);
  const push = useToastStore((s) => s.push);

  const open = (np: Parameters<typeof play>[0], title: string) => {
    play(np);
    if (previewHidden) showPreview();
    push({ message: `Now playing · ${title}`, tone: "ok" });
  };

  // Default view (no explicit pick) is live if the channel is live, else the
  // newest VOD — mirror that so the right row shows as "Playing".
  const liveActive = nowPlaying?.kind === "live" || (nowPlaying == null && live);
  const isVodActive = (id: string, i: number) =>
    (nowPlaying?.kind === "vod" && nowPlaying.id === id) || (nowPlaying == null && !live && i === 0);

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Radio size={14} className="text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Broadcasts</span>
        <span className="ml-auto text-[10px] text-muted">twitch.tv/{login} · {vods.length} VOD{vods.length === 1 ? "" : "s"}</span>
      </div>

      <div className="vc-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {/* Live channel */}
        <button
          onClick={() => open({ kind: "live" }, `${login} (live)`)}
          className={`group flex items-center gap-3 rounded-lg border p-2 text-left transition ${
            liveActive ? "border-accent/60 bg-accent/[0.08]" : "border-white/8 bg-white/[0.02] hover:border-accent/40 hover:bg-accent/[0.05]"
          }`}
        >
          <div className="relative grid h-11 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-white/10 bg-gradient-to-br from-[#9146ff]/40 to-black">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" aria-hidden><path d="M4 2 2.5 6v14H8v3h3l3-3h4l5-5V2H4Zm17 11-3 3h-5l-3 3v-3H6V4h15v9ZM16 7h-2v5h2V7Zm-5 0H9v5h2V7Z" /></svg>
            {live && <span className="absolute left-1 top-1 rounded bg-red-500 px-1 text-[7px] font-black uppercase text-white">live</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-ink">Live channel</div>
            <div className="mt-0.5 text-[10px] text-muted">{live ? "🔴 streaming now" : "offline — opens live player"}</div>
          </div>
          {liveActive && <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-accent">Playing</span>}
        </button>

        {/* Archived VODs */}
        {vods.map((b, i) => {
          const active = isVodActive(b.id, i);
          return (
            <button
              key={b.id}
              onClick={() => open({ kind: "vod", id: b.id }, b.title)}
              className={`group flex items-center gap-3 rounded-lg border p-2 text-left transition ${
                active ? "border-accent/60 bg-accent/[0.08]" : "border-white/8 bg-white/[0.02] hover:border-accent/40 hover:bg-accent/[0.05]"
              }`}
            >
              <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
                {b.thumbnail ? (
                  <img src={b.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center"><img src="/logo-white.png" alt="" className="h-5 w-5 opacity-20" /></div>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                  <Play size={16} className="text-white drop-shadow" />
                </span>
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[7px] font-bold tabular-nums text-white">{b.duration}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-ink">{b.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
                  <span>{b.createdAt.slice(0, 10)}</span>
                  <span className="flex items-center gap-0.5"><Clock size={9} /> {b.duration}</span>
                </div>
              </div>
              {active && <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-accent">Playing</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
