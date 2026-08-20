import { useMemo, useRef } from "react";
import { useChatStore } from "@/store/chatStore";
import { SourceBadge } from "./SourceBadge";
import { EmoteText } from "./Message";
import type { OverlayElement } from "@shared/types";

/**
 * A live unified-chat panel for the on-screen / OBS overlay. Transparent,
 * scale-aware, auto-scrolls to the newest message. Reads the same firehose as
 * the in-app feed so the overlay and dashboard stay perfectly in sync.
 */
export function OverlayChat({ el }: { el: OverlayElement }) {
  const messages = useChatStore((s) => s.messages);
  const enabled = useChatStore((s) => s.enabled);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => messages.filter((m) => enabled[m.platform]).slice(-40),
    [messages, enabled],
  );


  const w = el.w ?? 320;
  const h = el.h ?? 380;
  // Strong text shadow keeps chat legible over any stream — no panel, no blur.
  const shadow = "0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,1)";

  return (
    <div style={{ transform: `scale(${el.scale})`, transformOrigin: "top left", width: w, height: h }}>
      <div className="flex h-full w-full flex-col overflow-hidden">
        {el.showLabel && (
          <div className="flex shrink-0 items-center gap-1.5 px-1 pb-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" style={{ boxShadow: "0 0 4px rgba(0,0,0,0.9)" }} />
            <span className="text-[10px] font-black uppercase tracking-widest text-accent" style={{ textShadow: shadow }}>Live Chat</span>
          </div>
        )}
        {/* No scrolling at all — the column is ANCHORED TO THE BOTTOM
            (justify-end + overflow-hidden), so the newest message always sits
            at the bottom edge and older ones slide up and off the top. Scroll
            positioning in an OBS browser source proved fragile (it froze once
            the buffer filled); a bottom-anchored clip can't get stuck. */}
        <div ref={scrollRef} className="flex flex-1 flex-col justify-end gap-1 overflow-hidden px-1 py-0.5">
          {visible.map((m) => (
            <div key={m.id} className="flex items-start gap-1.5 text-[13px] font-semibold leading-snug" style={{ textShadow: shadow }}>
              <span className="mt-0.5 shrink-0">
                <SourceBadge platform={m.platform} compact />
              </span>
              <span className="min-w-0">
                <span className="font-extrabold" style={{ color: m.color || "var(--vc-accent)" }}>
                  {m.username}
                </span>
                <span className="mx-1 text-white/60">·</span>
                <span className="break-words text-white"><EmoteText message={m.message} emotes={m.emotes} /></span>
              </span>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="grid h-full place-items-center text-xs font-semibold text-white/70" style={{ textShadow: shadow }}>Waiting for messages…</div>
          )}
        </div>
      </div>
    </div>
  );
}
