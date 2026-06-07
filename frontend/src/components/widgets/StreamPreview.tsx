import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors, Radio, EyeOff, Eye, Monitor, Play, Pause } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { useToastStore } from "@/store/toastStore";
import { useClipsStore } from "@/store/clipsStore";
import { useConnectionsStore } from "@/store/connectionsStore";
import { usePreviewStore } from "@/store/previewStore";
import { useAudioStore } from "@/store/audioStore";
import { useModeStore } from "@/store/modeStore";
import { useBroadcastStore, BROADCASTS } from "@/store/broadcastStore";
import { SourceBadge, platformColor } from "../SourceBadge";
import { LiveTimer } from "../LiveTimer";
import { compact } from "@/lib/format";
import type { Account } from "@shared/types";

/** seconds → M:SS */
function clock(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

/** A real, embeddable live-player URL for a channel — Twitch & Kick support an
 *  iframe player by channel name. YouTube/X have no by-handle embed, so they
 *  fall back to the preview clip. */
function liveEmbedUrl(account: Account | undefined): string | null {
  if (!account) return null;
  const handle = account.handle.replace(/^@/, "");
  if (!handle) return null;
  if (account.platform === "twitch") return `https://player.twitch.tv/?channel=${handle}&parent=${location.hostname}&muted=true&autoplay=true`;
  if (account.platform === "kick") return `https://player.kick.com/${handle}?muted=true&autoplay=true`;
  return null;
}

/**
 * The center-stage stream preview. Shows the currently-watched channel (chat
 * velocity rendered as a live market chart — the seam for a real Twitch/YouTube
 * player embed) with a per-channel switcher, a live clip button, and a one-tap
 * hide so streamers who don't want a preview can collapse it.
 */
export function StreamPreview() {
  const velocity = useStatsStore((s) => s.snapshot.velocity);
  const hot = useStatsStore((s) => s.snapshot.hot);
  const totalViewers = useStatsStore((s) => s.snapshot.totals.viewers);
  const accountStats = useStatsStore((s) => s.snapshot.accounts);
  const accounts = useConnectionsStore((s) => s.accounts);
  const hidden = usePreviewStore((s) => s.hidden);
  const toggleHidden = usePreviewStore((s) => s.toggle);
  const push = useToastStore((s) => s.push);
  const capture = useClipsStore((s) => s.capture);
  const gid = useId().replace(/:/g, "");

  const muted = useAudioStore((s) => s.muted);
  const volume = useAudioStore((s) => s.volume);
  const demo = useModeStore((s) => s.demo);
  const currentId = useBroadcastStore((s) => s.currentId);
  const selectBroadcast = useBroadcastStore((s) => s.select);
  const broadcast = BROADCASTS.find((b) => b.id === currentId) ?? BROADCASTS[0];
  const videoRef = useRef<HTMLVideoElement>(null);

  const [pick, setPick] = useState<string | null>(null); // accountId of focused channel
  const [videoOk, setVideoOk] = useState(true); // falls back to the chart skin if the clip can't load
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const onSeek = (t: number) => {
    const v = videoRef.current;
    if (v) { v.currentTime = t; setProgress(t); }
  };

  // Drive the <video> muted/volume from the shared audio store (set as
  // properties, not attributes, so they update live).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = volume;
  }, [muted, volume, videoOk, hidden]);

  // Channels sorted by activity for the switcher.
  const channels = useMemo(
    () =>
      [...accountStats]
        .sort((a, b) => b.viewers - a.viewers)
        .map((a) => ({ ...a, meta: accounts.find((x) => x.id === a.accountId) }))
        .filter((a) => a.meta),
    [accountStats, accounts],
  );

  // A channel counts as "live" when it currently has viewers (the real poller
  // reports 0 for an offline channel; demo channels are always live). While the
  // stats are still warming up we treat connected channels as live so the tile
  // doesn't flash the VOD fallback for a frame before the live feed appears.
  const liveChannels = useMemo(() => channels.filter((c) => (c.viewers ?? 0) > 0), [channels]);
  const statsWarming = channels.length === 0 && accounts.some((a) => a.connected);
  const anyLive = liveChannels.length > 0 || statsWarming;

  const focused = useMemo(
    () => channels.find((c) => c.accountId === pick) ?? liveChannels[0] ?? channels[0],
    [channels, liveChannels, pick],
  );
  const focusViewers = focused?.viewers ?? totalViewers;

  // What the preview shows, in priority order:
  //  1. a VOD the user explicitly picked          → that VOD file
  //  2. the live view + any channel is live        → that channel's live stream
  //     (real Twitch/Kick embed in Live mode, else its distinct demo clip)
  //  3. the live view + nothing is live            → fall back to the most recent
  //     past broadcast, so the tile is never blank
  const latestVod = useMemo(() => BROADCASTS.find((b) => !b.live) ?? BROADCASTS[BROADCASTS.length - 1], []);
  const fallbackToVod = broadcast.live && !anyLive;
  const shownBroadcast = fallbackToVod ? latestVod : broadcast;

  const liveView = shownBroadcast.live;
  const embedUrl = liveView && !demo ? liveEmbedUrl(focused?.meta) : null;
  // Play the selected broadcast recording directly (the MarketBubble show) — a
  // plain <video>, so there's no cross-origin iframe to "refuse to connect".
  const previewSrc = shownBroadcast.src;

  // Seek to the start frame + (re)start playback whenever the source (VOD or
  // focused channel) changes. Wait for `canplay` (readyState ≥ 3) so play()
  // actually starts — loadedmetadata fires too early and the muted autoplay
  // can be a no-op after a programmatic src swap.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const go = () => { v.currentTime = shownBroadcast.startAt ?? 0; v.play().catch(() => {}); };
    if (v.readyState >= 3) { go(); return; }
    v.addEventListener("canplay", go, { once: true });
    return () => v.removeEventListener("canplay", go);
  }, [previewSrc, shownBroadcast.startAt]);

  const chart = useMemo(() => {
    const W = 100, H = 56;
    if (velocity.length < 2) return { line: "", area: "" };
    const max = Math.max(10, ...velocity);
    const x = (i: number) => (i / (velocity.length - 1)) * W;
    const y = (v: number) => H - 6 - (v / max) * (H - 12);
    const line = velocity.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return { line, area: `${line} L${W},${H} L0,${H} Z` };
  }, [velocity]);

  const clipNow = () => {
    capture("manual", focused ? `${focused.meta!.displayName} preview` : "Stream preview");
    push({ message: "✂ Clipped this moment", tone: "ok" });
  };

  if (hidden) {
    return (
      <div className="flex h-full items-center justify-between p-3">
        <div className="flex items-center gap-2 text-muted">
          <Monitor size={15} />
          <span className="text-[11px] font-bold uppercase tracking-widest">Stream Preview</span>
          <span className="text-[10px] opacity-70">hidden</span>
        </div>
        <button
          onClick={toggleHidden}
          className="flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-xs font-bold text-muted transition hover:border-accent/50 hover:text-accent"
        >
          <Eye size={14} /> Show preview
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Radio size={14} className={hot ? "animate-pulse-glow text-accent" : "text-muted"} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Stream Preview</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AnimatePresence>
            {hot && (
              <motion.button
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
                onClick={clipNow}
                className="flex items-center gap-1 rounded-full border border-accent bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent shadow-neon"
              >
                <Scissors size={11} /> CLIP THIS
              </motion.button>
            )}
          </AnimatePresence>
          <button onClick={toggleHidden} title="Hide preview" className="rounded-md p-1 text-muted transition hover:text-ink">
            <EyeOff size={15} />
          </button>
        </div>
      </div>

      {/* 16:9 preview — real stream video (fully visible, never cropped), with
          the chat-velocity chart as a fallback skin */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black">
        {embedUrl ? (
          /* Live mode: the focused channel's real platform player. */
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={`${focused?.meta?.displayName ?? "Live"} stream`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <video
            ref={videoRef}
            src={previewSrc}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoOk(false)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onClick={togglePlay}
            className={`absolute inset-0 h-full w-full cursor-pointer object-contain ${videoOk ? "" : "hidden"}`}
          />
        )}
        {/* big center play affordance when paused */}
        {!embedUrl && videoOk && !playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 z-[5] grid place-items-center bg-black/30"
            title="Play"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-white/70 bg-black/50 text-white">
              <Play size={26} className="ml-1" />
            </span>
          </button>
        )}
        {!embedUrl && !videoOk && (
          <>
            <img src="/logo-white.png" alt="" className="pointer-events-none absolute left-1/2 top-1/2 h-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06]" />
            <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id={`prev-${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--vc-accent)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--vc-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {chart.area && <path d={chart.area} fill={`url(#prev-${gid})`} />}
              {chart.line && <path d={chart.line} fill="none" stroke="var(--vc-accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
            </svg>
            <div className="pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.05)_50%,transparent_60%)] bg-[length:200%_100%]" />
          </>
        )}

        {shownBroadcast.live ? (
          <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-400 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
            Live
            <LiveTimer className="tabular-nums text-white/90" />
          </span>
        ) : (
          <span className="absolute left-2 top-2 flex max-w-[70%] items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent backdrop-blur">
            <span className="rounded bg-accent/20 px-1">{fallbackToVod ? "No live · Replay" : "VOD"}</span>
            <span className="truncate normal-case text-white/90">{shownBroadcast.title}</span>
          </span>
        )}
        <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-ink backdrop-blur">👁 {compact(focusViewers)}</span>
        {liveView && focused?.meta && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 backdrop-blur">
            <SourceBadge platform={focused.meta.platform} compact />
            <span className="text-[11px] font-semibold text-ink">{focused.meta.displayName}</span>
          </span>
        )}
        <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] tabular-nums text-muted backdrop-blur">{velocity[velocity.length - 1] ?? 0} msg/min</span>
      </div>

      {/* transport — play/pause + seek the whole clip */}
      {!embedUrl && videoOk && (
        <div className="mt-2 flex shrink-0 items-center gap-2">
          <button onClick={togglePlay} title={playing ? "Pause" : "Play"} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/12 text-white transition hover:border-accent/60 hover:text-accent">
            {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(progress, duration || 0)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="vc-volume h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
            style={{ background: `linear-gradient(to right, var(--vc-accent) ${duration ? (progress / duration) * 100 : 0}%, rgba(255,255,255,0.12) ${duration ? (progress / duration) * 100 : 0}%)` }}
            title="Scrub the clip"
          />
          <span className="shrink-0 text-[10px] tabular-nums text-muted">{clock(progress)} / {clock(duration)}</span>
        </div>
      )}

      {/* channel switcher */}
      {channels.length > 1 && (
        <div className="vc-scroll mt-2 flex shrink-0 gap-1.5 overflow-x-auto pb-0.5">
          {channels.map((c) => {
            const on = c.accountId === (focused?.accountId ?? "");
            return (
              <button
                key={c.accountId}
                onClick={() => { setPick(c.accountId); selectBroadcast("live"); }}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                  on ? "bg-white/[0.06]" : "border-white/8 text-muted hover:text-ink"
                }`}
                style={on ? { borderColor: platformColor(c.meta!.platform), color: platformColor(c.meta!.platform) } : undefined}
              >
                <SourceBadge platform={c.meta!.platform} compact />
                {c.meta!.displayName}
                <span className="tabular-nums opacity-70">{compact(c.viewers)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
