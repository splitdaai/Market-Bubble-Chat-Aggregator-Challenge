import { useState } from "react";
import { Zap } from "lucide-react";
import type { PanelLayout } from "@shared/types";
import { useViewerStore } from "@/store/viewerStore";
import { useModeStore } from "@/store/modeStore";
import { useUiModeStore } from "@/store/uiModeStore";
import { StreamPreview } from "./widgets/StreamPreview";
import { ChatFeed } from "./ChatFeed";
import { AccountModal } from "./AccountModal";

const CHAT_PANEL: PanelLayout = { i: "simple-chat", widget: "chat-feed", x: 0, y: 0, w: 12, h: 12 };

/**
 * Simple (stock) shell — just the stream + the unified chat, Banks' core.
 * One "Pro" tap (header) flips to the full dashboard. Reuses the real
 * StreamPreview embed + the unified ChatFeed, so no new data wiring.
 */
export function SimpleApp() {
  const setUiMode = useUiModeStore((s) => s.setMode);
  const demo = useModeStore((s) => s.demo);
  const toggleDemo = useModeStore((s) => s.toggle);
  const xHandle = useViewerStore((s) => s.xHandle);
  const [account, setAccount] = useState(false);

  return (
    <div className="vc-aurora vc-grid-texture relative flex h-screen flex-col bg-[var(--vc-bg)] text-ink">
      <header className="relative z-10 flex shrink-0 items-center gap-3 px-4 py-3">
        <img src="/market-bubble-logo.svg" alt="Market Bubble" className="h-24 w-auto" />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleDemo}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${demo ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}
          >
            {demo ? "DEMO" : "LIVE"}
          </button>
          <button onClick={() => setAccount(true)} className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[13px] font-bold">
            {xHandle ? `@${xHandle}` : "Connect"}
          </button>
          <button
            onClick={() => setUiMode("pro")}
            title="Show markets, KOL tracker, analytics & more"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-bold text-black shadow-neon"
          >
            <Zap size={14} /> Pro
          </button>
        </div>
      </header>

      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[1fr_minmax(340px,400px)]">
        <div className="vc-glass min-h-0 overflow-hidden rounded-2xl"><StreamPreview /></div>
        <div className="vc-glass min-h-0 overflow-hidden rounded-2xl"><ChatFeed panel={CHAT_PANEL} /></div>
      </main>

      {account && <AccountModal open={account} onClose={() => setAccount(false)} />}
    </div>
  );
}
