import { useEffect } from "react";
import { ChatFeed } from "./ChatFeed";
import { useStatsStore } from "@/store/statsStore";
import { compact } from "@/lib/format";
import type { PanelLayout } from "@shared/types";

const DOCK_PANEL: PanelLayout = { i: "dock", widget: "chat-feed", x: 0, y: 0, w: 12, h: 12 };

/**
 * Compact dock view (rendered for `?dock=1`). Designed to live INSIDE OBS as a
 * Custom Browser Dock — a slim brand bar + the unified multi-platform feed with
 * its per-platform filters and right-click moderation, all in a narrow panel.
 */
export function DockView() {
  const viewers = useStatsStore((s) => s.snapshot.totals.viewers);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#04100c";
    return () => { document.body.style.background = prev; };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-bg text-ink">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <img src="/logo-white.png" alt="" className="h-5 w-5" />
          <span className="text-sm font-extrabold leading-none">Market <span className="text-accent">Bubble</span></span>
          <span className="flex items-center gap-1 rounded border border-red-500/50 bg-red-500/15 px-1 text-[8px] font-black uppercase tracking-wider text-red-400">
            <span className="h-1 w-1 animate-ping rounded-full bg-red-500" /> Live
          </span>
        </div>
        <span className="text-xs font-bold tabular-nums text-ink">👁 {compact(viewers)}</span>
      </header>
      <div className="min-h-0 flex-1">
        <ChatFeed panel={DOCK_PANEL} />
      </div>
    </div>
  );
}
