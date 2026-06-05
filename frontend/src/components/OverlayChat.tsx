import { useEffect, useMemo, useRef } from "react";
import { useChatStore } from "@/store/chatStore";
import { SourceBadge } from "./SourceBadge";
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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visible.length]);

  const w = el.w ?? 320;
  const h = el.h ?? 380;

  return (
    <div style={{ transform: `scale(${el.scale})`, transformOrigin: "top left", width: w, height: h }}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl border backdrop-blur-md"
        style={{
          background: "rgba(8,6,16,0.62)",
          borderColor: "color-mix(in srgb, var(--vc-accent) 40%, transparent)",
          boxShadow: "0 0 22px color-mix(in srgb, var(--vc-accent) 28%, transparent)",
        }}
      >
        {el.showLabel && (
          <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Live Chat</span>
          </div>
        )}
        <div ref={scrollRef} className="vc-scroll flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-2">
          {visible.map((m) => (
            <div key={m.id} className="flex items-start gap-1.5 text-[13px] leading-snug">
              <span className="mt-0.5 shrink-0">
                <SourceBadge platform={m.platform} compact />
              </span>
              <span className="min-w-0">
                <span className="font-bold" style={{ color: m.color || "var(--vc-accent)" }}>
                  {m.username}
                </span>
                <span className="mx-1 text-white/40">·</span>
                <span className="break-words text-white/90">{m.message}</span>
              </span>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="grid h-full place-items-center text-xs text-white/40">Waiting for messages…</div>
          )}
        </div>
      </div>
    </div>
  );
}
