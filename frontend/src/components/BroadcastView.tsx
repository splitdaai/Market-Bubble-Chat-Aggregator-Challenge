import { useEffect, useRef, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChatStore } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";
import { useModeStore } from "@/store/modeStore";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { byStreamer } from "@/lib/streamers";
import { Message } from "./Message";
import { platformIcon, platformLabel, platformColor, CHAT_PLATFORMS } from "./SourceBadge";
import { compact } from "@/lib/format";
import { moderate } from "@/lib/api";
import { LiveTimer } from "./LiveTimer";
import { EngagementQr, OverlayEngagementLayer } from "./OverlayEngagementLayer";
import { ENGAGE_ROOM } from "@/lib/overlayEngagement";
import type { Platform } from "@shared/types";

/**
 * OBS Browser Source: center-screen broadcast panel ("Chat Only").
 *
 * Drop `?broadcast=1` into OBS as a Browser Source at whatever width fits your
 * center column (the show's OBS layout: ~600–800 px wide between the hosts).
 * Displays the unified aggregated chat + combined viewers. No extra chrome.
 *
 * URL params:
 *   ?broadcast=1            — renders this view (clean, for OBS)
 *   &stage=1                — DEMO: blurred hosts backdrop with the chat panel
 *                             standing out center-screen, simulating its spot
 *                             on the broadcast between Ansem & Banks
 *   &bg=transparent         — transparent background for chroma-free compositing
 *   &platform=twitch,kick   — comma-separated filter (all platforms if omitted)
 *   &fontsize=16            — base font size in px (default 15)
 */

const SCROLL_THRESHOLD = 120; // px from bottom before we consider it "scrolled up"

/** Per-streamer viewer chip — hover reveals that streamer's platform split. */
function StreamerChip({ name, viewers, breakdown }: { name: string; viewers: number; breakdown: { platform: Platform; viewers: number }[] }) {
  return (
    <span className="group relative flex cursor-default items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: "#e8c987", background: "rgba(217,165,71,0.08)", border: "1px solid rgba(217,165,71,0.3)" }}>
      {name}
      <span className="tabular-nums" style={{ color: "#f3efe7" }}>{compact(viewers)}</span>

      {/* Hover: per-platform breakdown */}
      <span className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 hidden min-w-[148px] flex-col gap-1 rounded-xl p-2.5 group-hover:flex" style={{ background: "#14100a", border: "1px solid rgba(217,165,71,0.35)", boxShadow: "0 12px 32px rgba(0,0,0,0.65)" }}>
        <span className="mb-0.5 text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: "#9a8f7e" }}>{name} · by platform</span>
        {breakdown.map((b) => (
          <span key={b.platform} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: platformColor(b.platform) }}>
              <span className="grid place-items-center">{platformIcon(b.platform)}</span>
              {platformLabel(b.platform)}
            </span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: "#f3efe7" }}>{compact(b.viewers)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

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
  const stage = params.has("stage");
  const transparent = !stage && params.get("bg") === "transparent";
  const room = params.get("room") || ENGAGE_ROOM;
  const showQr = params.get("qr") !== "0";
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

  // Per-streamer totals (Ansem / Banks / Market Bubble) + platform split each.
  const streamers = useMemo(() => byStreamer(snapshot.accounts), [snapshot.accounts]);
  const breakdownFor = (name: string) =>
    snapshot.accounts
      .filter((a) => a.displayName === name && a.viewers > 0)
      .map((a) => ({ platform: a.platform, viewers: a.viewers }))
      .sort((x, y) => y.viewers - x.viewers);

  // Newest message id — drives auto-scroll. Keying on the id (not length) keeps
  // the feed following live even after the buffer hits its cap, where length
  // stops changing but new messages still arrive.
  const newestId = visible.length ? visible[visible.length - 1].id : null;

  // Auto-scroll pinned to bottom; pauses when the user scrolls up to read back.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [newestId, pinned]);

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

  // Page background for OBS modes
  useEffect(() => {
    if (transparent) {
      document.body.style.background = "transparent";
      document.documentElement.style.background = "transparent";
    } else {
      document.body.style.background = "#080706";
    }
  }, [transparent]);

  const totalViewers = snapshot.totals.viewers;

  // ── The chat panel itself (header + feed) ──
  const panel = (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{
        fontSize: fontPx,
        color: "#f3efe7",
        background: transparent ? "transparent" : "#080706",
      }}
    >
      {/* ── Header strip (On Air broadcast lower-third) ── */}
      <header
        className="relative flex shrink-0 items-center justify-between px-4 pt-2.5 pb-3"
        style={{ background: transparent ? "rgba(20,16,10,0.78)" : "linear-gradient(180deg, rgba(40,33,22,0.55), rgba(8,7,6,0))" }}
      >
        {/* Left: real logo + LIVE pill + timer */}
        <div className="flex shrink-0 items-center gap-2.5">
          <img src="/market-bubble-logo.svg" alt="Market Bubble" className="h-8 w-auto" />
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5" style={{ border: "1px solid rgba(217,165,71,0.4)", background: "rgba(217,165,71,0.1)" }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#d9a547" }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#e8c987" }}>Live</span>
            <LiveTimer className="text-[11px] font-bold tabular-nums text-[#e8c987]/70" />
          </div>
        </div>

        {/* Right: total viewers + per-streamer chips (hover = platform split) */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex shrink-0 items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "rgba(243,239,231,0.45)" }} aria-hidden>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-[15px] font-black tabular-nums" style={{ color: "#f3efe7" }}>{compact(totalViewers)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {streamers.filter((s) => s.viewers > 0).map((s) => (
              <StreamerChip key={s.name} name={s.name} viewers={s.viewers} breakdown={breakdownFor(s.name)} />
            ))}
          </div>

          {demo && !stage && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ border: "1px solid rgba(217,165,71,0.3)", background: "rgba(217,165,71,0.1)", color: "#e8c987" }}>
              Demo
            </span>
          )}
        </div>

        {/* Gold sheen baseline — the broadcast lower-third accent */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: "linear-gradient(90deg, rgba(217,165,71,0) 0%, rgba(217,165,71,0.65) 25%, rgba(232,201,135,0.85) 50%, rgba(217,165,71,0.65) 75%, rgba(217,165,71,0) 100%)" }} />
      </header>

      {/* ── Chat feed ── */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
        style={{ scrollbarWidth: "none" }}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {/* Bottom-anchored like Twitch — messages grow upward. No exit
            animations: with a bottom-anchored flex column, exiting items
            linger in flow and mash into the incoming ones. */}
        <div className="flex min-h-full flex-col justify-end">
          {visible.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
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
        </div>
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
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-black"
            style={{ background: "#d9a547", color: "#14100a", boxShadow: "0 6px 22px rgba(217,165,71,0.4)" }}
          >
            ↓ Jump to live
          </motion.button>
        )}
      </AnimatePresence>

      <OverlayEngagementLayer room={room} />
      {showQr && <EngagementQr room={room} />}
    </div>
  );

  // ── Plain mode (real OBS source): the panel fills the viewport ──
  if (!stage) return <div className="h-screen">{panel}</div>;

  return <StageView panel={panel} />;
}

// ── Stage mode (demo): the chat installed INTO the show frame — unblurred
// footage in a fixed 16:9 box, panel composited over the center capture
// tile. Edit mode lets the operator drag/resize the panel to line it up
// with whatever scene they're going to use, and persists the result so it
// holds across reloads.

/** Pixel-measured off the show frame: the panel covers the center capture
 *  tile exactly, with a small bleed past the inside edge of the white border
 *  so the slightly-rounded inner corners of the tile can't let video peek
 *  through. Inside edges of the white border live at x 523→1397, y 55→679
 *  on 1920×1080; we extend ~4px past each one. Percentages are relative to
 *  the letterboxed 16:9 frame, so this tracks the tile at every window
 *  size. */
const DEFAULT_TILE = { left: 27.05, top: 4.7, width: 45.9, height: 58.5 };
const TILE_KEY = "vibechat-broadcast-tile";

interface Tile { left: number; top: number; width: number; height: number }

function loadTile(): Tile {
  try {
    const raw = localStorage.getItem(TILE_KEY);
    if (raw) {
      const t = JSON.parse(raw) as Partial<Tile>;
      if (typeof t.left === "number" && typeof t.top === "number" && typeof t.width === "number" && typeof t.height === "number") return t as Tile;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_TILE };
}

function StageView({ panel }: { panel: React.ReactNode }) {
  const [tile, setTile] = useState<Tile>(() => loadTile());
  const [edit, setEdit] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  // Persist on change (skip writes if equal to defaults so a "Reset" clears localStorage cleanly).
  useEffect(() => {
    try {
      const isDefault = tile.left === DEFAULT_TILE.left && tile.top === DEFAULT_TILE.top && tile.width === DEFAULT_TILE.width && tile.height === DEFAULT_TILE.height;
      if (isDefault) localStorage.removeItem(TILE_KEY);
      else localStorage.setItem(TILE_KEY, JSON.stringify(tile));
    } catch { /* ignore */ }
  }, [tile]);

  // Pointer-driven drag + resize. We convert pixels → frame-relative percent
  // so the saved position is resolution-independent.
  const dragRef = useRef<{ mode: "move" | "resize"; sx: number; sy: number; t0: Tile; frameW: number; frameH: number } | null>(null);

  function onPointerDown(mode: "move" | "resize") {
    return (e: React.PointerEvent) => {
      if (!edit) return;
      e.preventDefault();
      e.stopPropagation();
      const frame = frameRef.current;
      if (!frame) return;
      const r = frame.getBoundingClientRect();
      dragRef.current = { mode, sx: e.clientX, sy: e.clientY, t0: { ...tile }, frameW: r.width, frameH: r.height };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxPct = ((e.clientX - d.sx) / d.frameW) * 100;
      const dyPct = ((e.clientY - d.sy) / d.frameH) * 100;
      if (d.mode === "move") {
        setTile({
          left: clamp(d.t0.left + dxPct, 0, 100 - d.t0.width),
          top: clamp(d.t0.top + dyPct, 0, 100 - d.t0.height),
          width: d.t0.width,
          height: d.t0.height,
        });
      } else {
        setTile({
          left: d.t0.left,
          top: d.t0.top,
          width: clamp(d.t0.width + dxPct, 12, 100 - d.t0.left),
          height: clamp(d.t0.height + dyPct, 10, 100 - d.t0.top),
        });
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, []);

  const tileStyle = {
    left: `${tile.left}%`,
    top: `${tile.top}%`,
    width: `${tile.width}%`,
    height: `${tile.height}%`,
  };

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden" style={{ background: "#000" }}>
      {/* 16:9 broadcast frame, letterboxed to the viewport */}
      <div ref={frameRef} className="relative" style={{ aspectRatio: "16 / 9", width: "min(100vw, 177.78vh)" }}>
        {/* The actual show footage — clean, no blur. Seeks past the intro
            slate so the hosts are on screen from frame 1. */}
        <video
          src="/stream-preview.mp4"
          autoPlay
          muted
          loop
          playsInline
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 24; }}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* The chat, installed over the center tile */}
        <div className="absolute z-10 flex flex-col" style={{ ...tileStyle, outline: edit ? "2px dashed #d9a547" : undefined, outlineOffset: edit ? 2 : 0 }}>
          {panel}

          {/* Edit affordances — grip on top to drag, handle at bottom-right to resize. */}
          {edit && (
            <>
              <div
                onPointerDown={onPointerDown("move")}
                title="Drag to reposition"
                className="absolute -top-3 left-1/2 z-30 flex -translate-x-1/2 cursor-move items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em]"
                style={{ background: "#d9a547", color: "#14100a", boxShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
              >
                ⋮⋮ Drag
              </div>
              <div
                onPointerDown={onPointerDown("resize")}
                title="Drag to resize"
                className="absolute -bottom-2 -right-2 z-30 h-6 w-6 cursor-nwse-resize rounded-md"
                style={{ background: "#d9a547", border: "2px solid #14100a", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
              />
            </>
          )}
        </div>
      </div>

      {/* Back to the dashboard — demo chrome only, never on the clean OBS route. */}
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        <a
          href="/"
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition hover:brightness-125"
          style={{ background: "rgba(8,7,6,0.82)", border: "1px solid rgba(217,165,71,0.4)", color: "#e8c987", backdropFilter: "blur(6px)" }}
        >
          ← Dashboard
        </a>
        <CopyObsUrlButton />
      </div>

      {/* Edit toggle + (when editing) live coordinates + reset */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {edit && (
          <>
            <span className="rounded-lg px-2.5 py-1 font-mono text-[11px]" style={{ background: "rgba(8,7,6,0.82)", border: "1px solid rgba(217,165,71,0.25)", color: "#e8c987", backdropFilter: "blur(6px)" }}>
              {tile.left.toFixed(1)},{tile.top.toFixed(1)} · {tile.width.toFixed(1)}×{tile.height.toFixed(1)}
            </span>
            <button
              onClick={() => setTile({ ...DEFAULT_TILE })}
              className="rounded-xl px-3 py-2 text-[13px] font-bold transition hover:brightness-125"
              style={{ background: "rgba(8,7,6,0.82)", border: "1px solid rgba(217,165,71,0.4)", color: "#e8c987", backdropFilter: "blur(6px)" }}
            >
              ↻ Reset
            </button>
          </>
        )}
        <button
          onClick={() => setEdit((v) => !v)}
          className="rounded-xl px-3 py-2 text-[13px] font-bold transition hover:brightness-125"
          style={
            edit
              ? { background: "#d9a547", color: "#14100a", border: "1px solid #d9a547", boxShadow: "0 4px 14px rgba(217,165,71,0.35)" }
              : { background: "rgba(8,7,6,0.82)", border: "1px solid rgba(217,165,71,0.4)", color: "#e8c987", backdropFilter: "blur(6px)" }
          }
        >
          {edit ? "✓ Done" : "✎ Edit"}
        </button>
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** "Copy OBS Source URL" pill on the stage preview — gives the operator the
 *  clean `?broadcast=1` URL (NOT the `&stage=1` preview URL) to paste into
 *  OBS as a Browser Source. */
function CopyObsUrlButton() {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}?broadcast=1`
    : "";
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };
  return (
    <button
      onClick={onCopy}
      title="Copy the clean OBS Browser Source URL — paste it in OBS → Sources → + → Browser"
      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition hover:brightness-125"
      style={{ background: "#d9a547", color: "#14100a", boxShadow: "0 4px 14px rgba(217,165,71,0.35)" }}
    >
      {copied ? "✓ Copied" : "⧉ Copy OBS URL"}
    </button>
  );
}
