import { motion, AnimatePresence } from "framer-motion";
import { Scissors, Trash2, Film, Eye, Clapperboard } from "lucide-react";
import { useClipsStore } from "@/store/clipsStore";
import { useToastStore } from "@/store/toastStore";
import { useTwitchStore } from "@/store/twitchStore";
import { usePreviewStore } from "@/store/previewStore";
import { getSocket } from "@/lib/socket";
import { SourceBadge, platformColor } from "../SourceBadge";
import { compact } from "@/lib/format";
import type { Clip, Platform } from "@shared/types";

const ALL: Platform[] = ["twitch", "kick", "x", "youtube"];

function clipTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

/**
 * Clip gallery. "Clip Now" snapshots the current moment (surrounding chat +
 * live viewer counts). "Cut on <platform>" asks the backend to create a native
 * platform clip and fills in the public URL when it returns.
 */
export function Clips() {
  const clips = useClipsStore((s) => s.clips);
  const capture = useClipsStore((s) => s.capture);
  const remove = useClipsStore((s) => s.remove);
  const clear = useClipsStore((s) => s.clear);
  const push = useToastStore((s) => s.push);

  // Real Twitch clips from twitch.tv/banks — click to play in the preview.
  const twitchClips = useTwitchStore((s) => s.clips);
  const twitchLogin = useTwitchStore((s) => s.login);
  const playClip = useTwitchStore((s) => s.play);
  const previewHidden = usePreviewStore((s) => s.hidden);
  const showPreview = usePreviewStore((s) => s.toggle);

  const openClip = (id: string, title: string) => {
    playClip({ kind: "clip", id });
    if (previewHidden) showPreview();
    push({ message: `▶ Playing clip · ${title}`, tone: "ok" });
  };

  const clipNow = () => {
    const c = capture("manual");
    push({ message: `✂ Clipped — ${c.context.length} lines of context saved`, tone: "ok" });
  };

  const cutNative = (clip: Clip, platform: Platform) => {
    const socket = getSocket();
    if (socket) {
      socket.emit("clip:create", { ...clip, sourcePlatform: platform });
      push({ message: `Cutting native ${platform} clip…`, tone: "info" });
    } else {
      push({ message: `Native ${platform} clip needs the backend (demo mode)`, tone: "info" });
    }
  };

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Film size={14} className="text-accent" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Clips</span>
          {clips.length > 0 && <span className="text-[10px] text-muted">· {clips.length}</span>}
        </div>
        <div className="flex items-center gap-1">
          {clips.length > 0 && (
            <button onClick={clear} className="rounded-md p-1 text-muted transition hover:text-red-300" title="Clear all">
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={clipNow}
            className="flex items-center gap-1 rounded-md border border-accent/50 bg-accent/15 px-2 py-1 text-[11px] font-bold text-accent shadow-neon transition hover:bg-accent/25"
          >
            <Scissors size={12} /> Clip Now
          </button>
        </div>
      </div>

      <div className="vc-scroll flex-1 space-y-2 overflow-y-auto">
        {/* Real Twitch clips from the channel */}
        {twitchClips.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="#9146ff" aria-hidden><path d="M4 2 2.5 6v14H8v3h3l3-3h4l5-5V2H4Zm17 11-3 3h-5l-3 3v-3H6V4h15v9ZM16 7h-2v5h2V7Zm-5 0H9v5h2V7Z" /></svg>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">From twitch.tv/{twitchLogin}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {twitchClips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openClip(c.id, c.title)}
                  className="group overflow-hidden rounded-lg border border-white/8 bg-white/[0.02] text-left transition hover:border-[#9146ff]/50"
                  title={c.title}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    {c.thumbnail && <img src={c.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />}
                    <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                      <Film size={16} className="text-white drop-shadow" />
                    </span>
                    <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded bg-black/70 px-1 text-[8px] font-bold tabular-nums text-white"><Eye size={7} /> {compact(c.viewCount)}</span>
                  </div>
                  <div className="truncate px-1.5 py-1 text-[10px] font-semibold text-ink">{c.title}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Your captured moments */}
        <div className="flex items-center gap-1.5 pt-1">
          <Scissors size={11} className="text-muted" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Your captured clips</span>
        </div>
        {clips.length === 0 && (
          <div className="grid place-items-center py-6 text-center text-[11px] text-muted opacity-70">
            <div>
              <Clapperboard size={18} className="mx-auto mb-1 opacity-60" />
              None yet — hit <span className="font-semibold text-accent">Clip Now</span> or let Clip Radar auto-catch a moment.
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {clips.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]"
            >
              {/* header */}
              <div className="flex items-center justify-between border-b border-white/8 px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${c.reason === "auto-radar" ? "text-accent" : "text-muted"}`}>
                    {c.reason === "auto-radar" ? "◈ Auto" : "✂ Clip"}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted">{clipTime(c.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {ALL.map((p) =>
                    c.viewers[p] != null ? (
                      <span key={p} className="flex items-center gap-0.5 text-[10px] font-semibold tabular-nums" style={{ color: platformColor(p) }} title={`${p} viewers`}>
                        <Eye size={9} /> {compact(c.viewers[p]!)}
                      </span>
                    ) : null,
                  )}
                  <button onClick={() => remove(c.id)} className="text-muted transition hover:text-red-300"><Trash2 size={12} /></button>
                </div>
              </div>

              {/* chat context preview */}
              <div className="max-h-20 space-y-0.5 overflow-hidden px-2.5 py-1.5">
                {c.context.slice(-4).map((line, i) => (
                  <div key={i} className="truncate text-[11px] leading-tight">
                    <span className="font-semibold" style={{ color: platformColor(line.platform) }}>{line.username}</span>
                    <span className="text-ink/70"> {line.message}</span>
                  </div>
                ))}
              </div>

              {/* actions */}
              <div className="flex gap-1 border-t border-white/8 px-2 py-1.5">
                {c.externalUrl ? (
                  <a href={c.externalUrl} target="_blank" rel="noreferrer" className="flex-1 rounded-md bg-accent/20 py-1 text-center text-[11px] font-bold text-accent hover:bg-accent/30">
                    Open clip ↗
                  </a>
                ) : (
                  ALL.map((p) => (
                    <button
                      key={p}
                      onClick={() => cutNative(c, p)}
                      className="flex-1 rounded-md border border-white/10 py-1 text-[10px] font-semibold capitalize text-muted transition hover:text-ink"
                      style={{ borderColor: `color-mix(in srgb, ${platformColor(p)} 35%, transparent)` }}
                    >
                      Cut {p}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
