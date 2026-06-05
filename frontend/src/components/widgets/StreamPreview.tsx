import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors, Radio, EyeOff, Eye, Monitor } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { useToastStore } from "@/store/toastStore";
import { useClipsStore } from "@/store/clipsStore";
import { useConnectionsStore } from "@/store/connectionsStore";
import { usePreviewStore } from "@/store/previewStore";
import { SourceBadge, platformColor } from "../SourceBadge";
import { compact } from "@/lib/format";

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

  const [pick, setPick] = useState<string | null>(null); // accountId of focused channel

  // Channels sorted by activity for the switcher.
  const channels = useMemo(
    () =>
      [...accountStats]
        .sort((a, b) => b.viewers - a.viewers)
        .map((a) => ({ ...a, meta: accounts.find((x) => x.id === a.accountId) }))
        .filter((a) => a.meta),
    [accountStats, accounts],
  );

  const focused = useMemo(
    () => channels.find((c) => c.accountId === pick) ?? channels[0],
    [channels, pick],
  );
  const focusViewers = focused?.viewers ?? totalViewers;

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

      {/* 16:9 preview */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-black/40 to-[color-mix(in_srgb,var(--vc-accent)_10%,#04100c)]">
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

        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-400 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
          Live
        </span>
        <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-ink backdrop-blur">👁 {compact(focusViewers)}</span>
        {focused?.meta && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 backdrop-blur">
            <SourceBadge platform={focused.meta.platform} compact />
            <span className="text-[11px] font-semibold text-ink">{focused.meta.displayName}</span>
          </span>
        )}
        <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] tabular-nums text-muted backdrop-blur">{velocity[velocity.length - 1] ?? 0} msg/min</span>
      </div>

      {/* channel switcher */}
      {channels.length > 1 && (
        <div className="vc-scroll mt-2 flex shrink-0 gap-1.5 overflow-x-auto pb-0.5">
          {channels.map((c) => {
            const on = c.accountId === (focused?.accountId ?? "");
            return (
              <button
                key={c.accountId}
                onClick={() => setPick(c.accountId)}
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
