import { useRef } from "react";
import { motion } from "framer-motion";
import { Move, Copy, Check, X as XIcon, Monitor, Trash2 } from "lucide-react";
import { useOverlayStore } from "@/store/overlayStore";
import { useToastStore } from "@/store/toastStore";
import { OverlayChip } from "./OverlayChip";
import { OverlayChat } from "./OverlayChat";
import { OverlayMarket } from "./OverlayMarket";
import type { OverlaySource } from "@shared/types";
import { useState } from "react";

const SOURCES: OverlaySource[] = ["combined", "twitch", "kick", "x", "youtube", "chat"];
const SOURCE_LABEL: Record<OverlaySource, string> = {
  combined: "Total",
  twitch: "Twitch",
  kick: "Kick",
  x: "X",
  youtube: "YouTube",
  pumpfun: "pump.fun",
  chat: "Chat",
  market: "Market",
};

/**
 * The in-app overlay editor. When enabled, viewer-count badges float over the
 * dashboard and can be dragged anywhere. Positions persist and are shared with
 * the standalone OBS browser-source route (`?overlay=1`).
 */
export function OverlayLayer() {
  const enabled = useOverlayStore((s) => s.enabled);
  const elements = useOverlayStore((s) => s.elements);
  const move = useOverlayStore((s) => s.move);
  const setSize = useOverlayStore((s) => s.setSize);
  const toggleSource = useOverlayStore((s) => s.toggleSource);
  const setEnabled = useOverlayStore((s) => s.setEnabled);
  const removeElement = useOverlayStore((s) => s.removeElement);
  const push = useToastStore((s) => s.push);
  const [copied, setCopied] = useState(false);

  const dragInfo = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resizeInfo = useRef<{ id: string; sx: number; sy: number; w: number; h: number; isMarket: boolean } | null>(null);

  if (!enabled) return null;

  const onPointerDown = (e: React.PointerEvent, id: string, x: number, y: number) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragInfo.current = { id, dx: e.clientX - x, dy: e.clientY - y };
  };
  const onResizeDown = (e: React.PointerEvent, id: string, w: number, h: number) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const isMarket = elements.find((el) => el.id === id)?.source === "market";
    resizeInfo.current = { id, sx: e.clientX, sy: e.clientY, w, h, isMarket };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const r = resizeInfo.current;
    if (r) {
      // market cards can shrink much skinnier than the chat panel
      const minW = r.isMarket ? 150 : 220;
      const minH = r.isMarket ? 60 : 200;
      const nw = Math.max(minW, Math.min(640, r.w + (e.clientX - r.sx)));
      const nh = Math.max(minH, Math.min(720, r.h + (e.clientY - r.sy)));
      setSize(r.id, nw, nh);
      return;
    }
    const d = dragInfo.current;
    if (!d) return;
    const nx = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - d.dx));
    const ny = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - d.dy));
    move(d.id, nx, ny);
  };
  const onPointerUp = () => { dragInfo.current = null; resizeInfo.current = null; };

  const copyObsLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?overlay=1`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      push({ message: "OBS browser-source URL copied", tone: "ok" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      push({ message: url, tone: "info" });
    }
  };

  return (
    // pointer-events-none so the overlay editor never blocks the dashboard
    // beneath it — only the chips, chat panel and control bar opt back in.
    <div className="pointer-events-none fixed inset-0 z-[140]" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {/* draggable chips + chat panel */}
      {elements.filter((el) => el.visible).map((el) => (
        <div
          key={el.id}
          className="pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing"
          style={{ left: el.x, top: el.y }}
          onPointerDown={(e) => onPointerDown(e, el.id, el.x, el.y)}
        >
          <div className="relative">
            <span className="pointer-events-none absolute -left-1 -top-5 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-accent opacity-80">
              <Move size={9} /> drag
            </span>
            {/* dynamic market cards get a remove button */}
            {el.source === "market" && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => removeElement(el.id)}
                title="Remove from overlay"
                className="absolute -right-2 -top-2 z-10 grid h-5 w-5 place-items-center rounded-full border border-red-400/60 bg-black/80 text-red-300 transition hover:bg-red-500/30"
              >
                <Trash2 size={11} />
              </button>
            )}
            {el.source === "chat" ? <OverlayChat el={el} /> : el.source === "market" ? <OverlayMarket el={el} /> : <OverlayChip el={el} />}
            {(el.source === "chat" || el.source === "market") && (
              <div
                onPointerDown={(e) => onResizeDown(e, el.id, el.w ?? 320, el.h ?? 380)}
                title="Drag to resize"
                className="absolute -bottom-1 -right-1 h-4 w-4 cursor-nwse-resize rounded-sm border border-accent/70 bg-black/70"
              />
            )}
          </div>
        </div>
      ))}

      {/* control bar */}
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="vc-glass pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 px-3 py-2"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent">
          <Monitor size={13} /> Overlay
        </span>
        <div className="h-4 w-px bg-white/15" />
        <span className="text-[10px] text-muted">show:</span>
        {SOURCES.map((src) => {
          const on = elements.find((e) => e.source === src)?.visible;
          return (
            <button
              key={src}
              onClick={() => toggleSource(src)}
              className={`rounded-md border px-2 py-1 text-[10px] font-bold transition ${
                on ? "border-accent bg-accent/15 text-accent" : "border-white/10 text-muted hover:text-ink"
              }`}
            >
              {SOURCE_LABEL[src]}
            </button>
          );
        })}
        <div className="h-4 w-px bg-white/15" />
        <button onClick={copyObsLink} className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] font-semibold text-ink transition hover:border-accent hover:text-accent">
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />} OBS link
        </button>
        <button onClick={() => setEnabled(false)} className="rounded-md p-1 text-muted transition hover:text-ink" title="Done">
          <XIcon size={14} />
        </button>
      </motion.div>
    </div>
  );
}
