import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Platform, ModerationAction, PanelLayout } from "@shared/types";
import { useChatStore } from "@/store/chatStore";
import { Message } from "./Message";
import { SourceBadge } from "./SourceBadge";
import { moderate } from "@/lib/api";
import { useToastStore } from "@/store/toastStore";
import { burst } from "./Particles";
import { accentColor } from "@/lib/theme";
import { ChevronDown } from "lucide-react";

const ALL: Platform[] = ["twitch", "kick", "x"];

/**
 * The unified feed. Newest at the bottom, smooth auto-scroll that pauses when
 * the user scrolls up to read history (with a "jump to live" pill).
 */
export function ChatFeed({ panel }: { panel: PanelLayout }) {
  const messages = useChatStore((s) => s.messages);
  const enabled = useChatStore((s) => s.enabled);
  const togglePlatform = useChatStore((s) => s.togglePlatform);
  const deleted = useChatStore((s) => s.deleted);
  const markDeleted = useChatStore((s) => s.markDeleted);
  const push = useToastStore((s) => s.push);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const lastHype = useRef<string | null>(null);

  // Panels can be scoped to specific platforms via props.platforms.
  const scoped = (panel.props?.platforms as Platform[] | undefined) ?? null;

  const visible = useMemo(
    () =>
      messages.filter(
        (m) => enabled[m.platform] && (!scoped || scoped.includes(m.platform)),
      ),
    [messages, enabled, scoped],
  );

  // Auto-scroll to bottom when pinned.
  useEffect(() => {
    if (pinned && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visible.length, pinned]);

  // Fire a particle burst when a new hype message lands.
  useEffect(() => {
    const newest = visible[visible.length - 1];
    if (newest?.hype && newest.id !== lastHype.current && pinned) {
      lastHype.current = newest.id;
      const el = scrollRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        burst(r.left + r.width / 2, r.bottom - 40, accentColor(), 30);
      }
    }
  }, [visible, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setPinned(atBottom);
  };

  const handleModerate = async (id: string, username: string, platform: Platform, action: ModerationAction) => {
    if (action.kind === "delete") markDeleted(id);
    const res = await moderate({ platform, messageId: id, username, action });
    const verb =
      action.kind === "delete" ? "Deleted message"
      : action.kind === "timeout" ? `Timed out ${username} (${action.seconds}s)`
      : action.kind === "ban" ? `Banned ${username}`
      : action.kind === "unban" ? `Unbanned ${username}`
      : `Slow mode ${action.seconds}s`;
    push({
      message: res.ok ? `${verb} · ${platform}` : `Failed: ${res.error}`,
      tone: res.ok ? "ok" : "error",
      onUndo: res.undoToken ? () => push({ message: "Undone", tone: "info" }) : undefined,
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* header / per-platform filters */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
            {scoped ? scoped.join(" · ") : "Unified"} Feed
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(scoped ?? ALL).map((p) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`transition ${enabled[p] ? "opacity-100" : "opacity-30 grayscale"}`}
              title={`${enabled[p] ? "Hide" : "Show"} ${p}`}
            >
              <SourceBadge platform={p} compact />
            </button>
          ))}
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="vc-scroll relative flex-1 overflow-y-auto px-1.5 py-2">
        <div className="flex flex-col gap-0.5">
          <AnimatePresence initial={false}>
            {visible.map((m) => (
              <Message
                key={m.id}
                msg={m}
                deleted={deleted.has(m.id)}
                onModerate={(a) => handleModerate(m.id, m.username, m.platform, a)}
              />
            ))}
          </AnimatePresence>
        </div>
        {visible.length === 0 && (
          <div className="grid h-full place-items-center text-sm text-muted">Waiting for messages…</div>
        )}
      </div>

      {/* jump-to-live */}
      {!pinned && (
        <button
          onClick={() => {
            setPinned(true);
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-accent/50 bg-black/70 px-3 py-1 text-xs font-semibold text-accent shadow-neon backdrop-blur"
        >
          <ChevronDown size={14} /> Live
        </button>
      )}
    </div>
  );
}
