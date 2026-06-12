import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Platform, ModerationAction, PanelLayout } from "@shared/types";
import { useChatStore } from "@/store/chatStore";
import { Message } from "./Message";
import { SourceBadge } from "./SourceBadge";
import { moderate } from "@/lib/api";
import { useToastStore } from "@/store/toastStore";
import { burst } from "./Particles";
import { accentColor } from "@/lib/theme";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { ChevronDown, Search, X as XIcon } from "lucide-react";
import { ChatComposer } from "./ChatComposer";

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
  const ALL = useActivePlatforms();

  // Panels can be scoped to specific platforms via props.platforms.
  const scoped = (panel.props?.platforms as Platform[] | undefined) ?? null;

  // Search / quick filters (collapsed behind the 🔍 in the header).
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<"all" | "hosts" | "mentions" | "tickers">("all");
  const closeSearch = () => { setSearchOpen(false); setQuery(""); setChip("all"); };
  const filtering = query.trim() !== "" || chip !== "all";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (!enabled[m.platform] || (scoped && !scoped.includes(m.platform))) return false;
      if (deleted.has(m.id)) return false;
      if (chip === "hosts" && !m.badges?.some((b) => b.type === "broadcaster" || b.type === "moderator")) return false;
      if (chip === "mentions" && !/@\w/.test(m.message)) return false;
      if (chip === "tickers" && !/\$[A-Za-z]{2,6}\b/.test(m.message)) return false;
      if (q && !m.message.toLowerCase().includes(q) && !m.username.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [messages, enabled, scoped, query, chip, deleted]);

  // Auto-scroll to bottom when pinned. Keyed on the newest message id (not
  // length) so it keeps following live once the buffer hits its cap — Twitch-
  // style: stays live unless you scroll up to read.
  const newestId = visible.length ? visible[visible.length - 1].id : null;
  useEffect(() => {
    if (pinned && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [newestId, pinned]);

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

  const handleModerate = async (msg: ChatMessage, action: ModerationAction) => {
    if (action.kind === "delete") markDeleted(msg.id);
    const res = await moderate({
      platform: msg.platform,
      localMessageId: msg.id,
      messageId: msg.nativeId ?? msg.id,
      channel: msg.channel ?? msg.accountId?.split(":").slice(1).join(":"),
      username: msg.username,
      userId: msg.nativeUserId,
      action,
    });
    const verb =
      action.kind === "delete" ? "Deleted message"
      : action.kind === "timeout" ? `Timed out ${msg.username} (${action.seconds}s)`
      : action.kind === "ban" ? `Banned ${msg.username}`
      : action.kind === "unban" ? `Unbanned ${msg.username}`
      : `Slow mode ${action.seconds}s`;
    const failedDelete = action.kind === "delete" && !res.ok;
    push({
      message: res.ok
        ? `${verb} · ${msg.platform}`
        : failedDelete
          ? `Hidden locally · ${msg.platform} platform delete failed: ${res.error}`
          : `Failed: ${res.error}`,
      tone: res.ok ? "ok" : failedDelete ? "info" : "error",
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
          <button
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            title="Search & filter messages"
            className={`mr-0.5 grid h-6 w-6 place-items-center rounded-md transition ${searchOpen || filtering ? "bg-accent/20 text-accent" : "text-muted hover:text-ink"}`}
          >
            <Search size={13} />
          </button>
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

      {/* search + quick filters — slim row that slides open under the header */}
      {searchOpen && (
          <div className="overflow-hidden border-b border-white/10">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1 focus-within:border-accent/50">
                <Search size={12} className="shrink-0 text-faint" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); }}
                  placeholder="Filter messages or users…"
                  className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-faint"
                />
                {query && <button onClick={() => setQuery("")} className="text-faint hover:text-ink"><XIcon size={12} /></button>}
              </div>
              {([["all", "All"], ["hosts", "Hosts"], ["mentions", "Mentions"], ["tickers", "Tickers"]] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setChip(k)}
                  className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold transition ${chip === k ? "bg-accent/20 text-accent" : "text-muted hover:text-ink"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {filtering && (
              <div className="px-3 pb-1.5 text-[10px] text-faint">{visible.length} match{visible.length === 1 ? "" : "es"} · live messages keep streaming in</div>
            )}
          </div>
      )}

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="vc-scroll relative flex-1 overflow-y-auto px-1.5 py-2">
        <div className="flex flex-col gap-0.5">
          {visible.map((m) => (
            <Message
              key={m.id}
              msg={m}
              deleted={deleted.has(m.id)}
              onModerate={(a) => handleModerate(m, a)}
            />
          ))}
        </div>
        {visible.length === 0 && (
          <div className="grid h-full place-items-center text-sm text-muted">Waiting for messages…</div>
        )}
      </div>

      {/* jump-to-live (sits just above the composer) */}
      {!pinned && (
        <button
          onClick={() => {
            setPinned(true);
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-accent/50 bg-black/70 px-3 py-1 text-xs font-semibold text-accent shadow-neon backdrop-blur"
        >
          <ChevronDown size={14} /> Live
        </button>
      )}

      {/* composer — send a message with emojis */}
      <ChatComposer />
    </div>
  );
}
