import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Send } from "lucide-react";
import type { Platform } from "@shared/types";
import { useChatStore } from "@/store/chatStore";
import { useViewerStore } from "@/store/viewerStore";
import { sendChat } from "@/lib/socket";
import { accentColor } from "@/lib/theme";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";

const EMOJIS = [
  "🔥", "🚀", "😂", "💜", "👀", "🎉", "💎", "🙌", "😭", "👏",
  "⚡", "💰", "📈", "📉", "🐂", "🐻", "🤝", "🫡", "💯", "😱",
  "❤️", "😍", "🤔", "😎", "🥳", "👑", "🎯", "✅", "❌", "🤡",
];

/** Send a message into the unified feed as the host, with an emoji picker. */
export function ChatComposer() {
  const addMessage = useChatStore((s) => s.addMessage);
  const platforms = useActivePlatforms();
  const xHandle = useViewerStore((s) => s.xHandle);
  const xName = useViewerStore((s) => s.xName);
  const xAvatar = useViewerStore((s) => s.xAvatar);
  const chatToken = useViewerStore((s) => s.chatToken);
  const [text, setText] = useState("");
  const [picker, setPicker] = useState(false);

  // If the viewer connected their X account, post as them on X; otherwise post
  // as the broadcaster on their primary connected platform.
  const platform: Platform = xHandle ? "x" : platforms.includes("x") ? "x" : platforms[0] ?? "x";

  const send = () => {
    const msg = text.trim();
    if (!msg) return;

    // Verified X login → broadcast to the SHARED feed via the backend. The
    // server echoes it back over `message` (to everyone, including us), so we
    // must NOT also add it locally or it would appear twice.
    if (chatToken && sendChat({ token: chatToken, text: msg })) {
      setText("");
      setPicker(false);
      return;
    }

    // Fallback — host message, or a logged-in viewer in demo mode (no backend
    // socket): local-only so the composer still works offline.
    addMessage({
      id: `me:${platform}:${Math.random().toString(36).slice(2)}`,
      nativeId: `me-${Math.random().toString(36).slice(2)}`,
      platform,
      channel: xHandle ? `@${xHandle}` : "Market Bubble",
      username: xHandle ? (xName ?? xHandle) : "Market Bubble",
      color: accentColor(),
      avatar: xHandle ? xAvatar ?? undefined : undefined,
      message: msg,
      timestamp: Date.now(),
      badges: xHandle ? [{ type: "broadcaster", label: "You" }] : [{ type: "broadcaster", label: "Host" }],
      hype: false,
    });
    setText("");
    setPicker(false);
  };

  return (
    <div className="relative shrink-0 border-t border-white/10 p-2">
      <AnimatePresence>
        {picker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPicker(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              className="vc-glass absolute bottom-14 left-2 z-20 grid w-[228px] grid-cols-10 gap-0.5 p-2"
            >
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => { setText((t) => t + e); }}
                  className="grid h-5 w-5 place-items-center rounded text-base transition hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-2 py-1">
        <button
          onClick={() => setPicker((p) => !p)}
          title="Emojis"
          className={`shrink-0 rounded-md p-1 transition ${picker ? "text-accent" : "text-muted hover:text-ink"}`}
        >
          <Smile size={17} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={xHandle ? `Chat as @${xHandle}…` : "Send a message…"}
          maxLength={240}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          title="Send"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/20 text-accent transition hover:bg-accent/30 disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
