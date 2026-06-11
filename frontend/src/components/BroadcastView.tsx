import { useEffect, useRef, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChatStore } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";
import { useModeStore } from "@/store/modeStore";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { Message } from "./Message";
import { platformColor, platformIcon, CHAT_PLATFORMS } from "./SourceBadge";
import { compact } from "@/lib/format";
import { moderate } from "@/lib/api";
import { LiveTimer } from "./LiveTimer";
import type { Platform } from "@shared/types";

/**
 * OBS Browser Source: center-screen broadcast panel.
 *
 * Drop `?broadcast=1` into OBS as a Browser Source at whatever width fits your
 * center column (Banks' current OBS layout: ~600–800 px wide, full height).
 * Displays the unified aggregated chat + combined viewer count. No extra chrome.
 *
 * URL params:
 *   ?broadcast=1            — renders this view
 *   &bg=transparent         — transparent background for chroma-free compositing
 *   &platform=twitch,kick   — comma-separated filter (all platforms if omitted)
 *   &fontsize=16            — base rem-equivalent in px (default 15)
 */

const SCROLL_THRESHOLD = 120; // px from bottom before we consider it "scrolled up"

export function BroadcastView() {
  const messages = useChatStore((s) => s.messages);
  const enabled = useChatStore((s) => s.enabled);
  const deleted = useChatStore((s) => s.deleted);
  const snapshot = useStatsStore((s) => s.snapshot);
  const ALL = useActivePlatforms();
  const demo = useModeStore((s) => s.demo);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  // Parse URL params once
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const transparent = params.get("bg") === "transparent";
  const fontPx = parseInt(params.get("fontsize") ?? "15", 10) || 15;
  const platformFilter = useMemo<Platform[] | null>(() => {
    const raw = params.get("platform");
    if (!raw) return null;
    const list = raw.split(",").filter((p) => CHAT_PLATFORMS.includes(p as Platform)) as Platform[];
    return list.length ? list : null;
  }, [params]);

  const activePlatforms = platformFilter ?? ALL;

  const visible = useMemo(
    () =>
      messages.filter(
        (m) =>
          enabled[m.platform] &&
          activePlatforms.includes(m.platform as Platform),
      ),
    [messages, enabled, activePlatforms],
  );

  // Auto-scroll pinned to bottom; pause when user scrolls up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [visible.length, pinned]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setPinned(distFromBottom < SCROLL_THRESHOLD);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Set background for OBS transparent mode
  useEffect(() => {
    if (transparent) {
      document.body.style.background = "transparent";
      document.documentElement.style.background = "transparent";
    } else {
      document.body.style.background = "#06100d";
    }
  }, [transparent]);

  const bgClass = transparent ? "bg-transparent" : "bg-[#06100d]";

  const totalViewers = snapshot.totals.viewers;

  return (
    <div
      className={`flex h-screen flex-col ${bgClass} text-white`}
      style={{ fontSize: fontPx }}
    >
      {/* ── Header strip ── */}
      <header className="flex shrink-0 items-center justify-between px-4 py-2.5 border-b border-white/[0.06]" style={{ background: transparent ? "rgba(6,16,13,0.72)" : "#07140f" }}>
        {/* Left: logo + LIVE pill + timer */}
        <div className="flex items-center gap-2.5">
          <img src="/market-bubble-logo.svg" alt="Market Bubble" className="h-7 w-auto" />
          <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/12 px-2 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-[11px] font-black uppercase tracking-widest text-red-400">Live</span>
            <LiveTimer className="text-[11px] font-bold tabular-nums text-red-300/80" />
          </div>
        </div>

        {/* Right: total viewers + per-platform chips */}
        <div className="flex items-center gap-3">
          {/* Combined viewer count */}
          <div className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-white/50" aria-hidden>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-[15px] font-black tabular-nums text-white">{compact(totalViewers)}</span>
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">viewers</span>
          </div>

          {/* Per-platform pills */}
          <div className="flex items-center gap-1.5">
            {activePlatforms.map((p) => {
              const v = snapshot.perPlatform[p]?.viewers ?? 0;
              if (!v) return null;
              const color = platformColor(p);
              return (
                <span
                  key={p}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    color,
                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
                  }}
                >
                  <span className="grid place-items-center" style={{ color }}>
                    {platformIcon(p)}
                  </span>
                  {compact(v)}
                </span>
              );
            })}
          </div>

          {/* Demo badge */}
          {demo && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
              Demo
            </span>
          )}
        </div>
      </header>

      {/* ── Chat feed ── */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
        style={{ scrollbarWidth: "none" }}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        <AnimatePresence initial={false}>
          {visible.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Message
                msg={msg}
                deleted={deleted.has(msg.id)}
                onModerate={(action) =>
                  moderate({ platform: msg.platform, username: msg.username, action })
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Jump-to-live pill ── */}
      <AnimatePresence>
        {!pinned && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => {
              const el = scrollRef.current;
              if (el) { el.scrollTop = el.scrollHeight; setPinned(true); }
            }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[12px] font-black text-black shadow-neon"
          >
            ↓ Jump to live
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
