import type { PanelLayout } from "@shared/types";
import { ChatFeed } from "../ChatFeed";

const CHAT_PANEL: PanelLayout = { i: "m-chat", widget: "chat-feed", x: 0, y: 0, w: 12, h: 12 };

/** Mobile Live: the show on top, the full unified chat (reused) filling the rest. */
export function MobileLive() {
  return (
    <div className="flex h-full flex-col">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden border-b border-white/10 bg-black">
        <video src="/stream-preview.mp4" autoPlay muted loop playsInline className="h-full w-full object-cover" />
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> LIVE
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ChatFeed panel={CHAT_PANEL} />
      </div>
    </div>
  );
}
