import { lazy, Suspense, useMemo, useState } from "react";
import { Zap, Plug, Palette, Pencil, Eye } from "lucide-react";
import type { PanelLayout, WidgetKind } from "@shared/types";
import { useViewerStore } from "@/store/viewerStore";
import { useWalletStore } from "@/store/walletStore";
import { useModeStore } from "@/store/modeStore";
import { useUiModeStore } from "@/store/uiModeStore";
import { renderWidget, WIDGET_META } from "./EditorCanvas";
import { PageGrid } from "./PageGrid";
import { AccountModal } from "./AccountModal";

const ConnectionsManager = lazy(() => import("./ConnectionsManager").then((m) => ({ default: m.ConnectionsManager })));
const ThemeEditor = lazy(() => import("./ThemeEditor").then((m) => ({ default: m.ThemeEditor })));

// Default placement + size for each addable widget on the Simple canvas.
const GEO: Record<string, [number, number, number, number]> = {
  "stream-preview": [0, 0, 8, 12],
  "chat-feed": [8, 0, 4, 12],
  stats: [0, 12, 4, 5],
  "top-chatters": [4, 12, 4, 7],
  polymarket: [8, 12, 4, 8],
  "user-list": [0, 17, 4, 7],
  clips: [4, 19, 4, 6],
  giveaway: [8, 20, 4, 7],
  "hype-meter": [0, 24, 4, 4],
  "mood-meter": [4, 25, 4, 4],
  "connection-status": [8, 27, 4, 4],
  "clip-radar": [0, 28, 4, 5],
  "button-deck": [4, 29, 4, 4],
  ops: [0, 33, 6, 6],
};

const ALL = Object.keys(WIDGET_META) as WidgetKind[];
// Every Pro widget is available; only the stream + chat show by default.
const DEFAULT_HIDDEN = ALL.filter((k) => k !== "stream-preview" && k !== "chat-feed");
const TITLES = Object.fromEntries(ALL.map((k) => [k, WIDGET_META[k].label]));

/**
 * Simple (stock) shell — stream + unified chat by default, but a full editable
 * canvas underneath: hit Edit → "Add tile" to drop in ANY Pro widget, then
 * drag/resize it anywhere. "Pro" flips to the full multi-tab dashboard.
 */
export function SimpleApp() {
  const setUiMode = useUiModeStore((s) => s.setMode);
  const demo = useModeStore((s) => s.demo);
  const toggleDemo = useModeStore((s) => s.toggle);
  const xHandle = useViewerStore((s) => s.xHandle);
  const address = useWalletStore((s) => s.address);
  const [account, setAccount] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [edit, setEdit] = useState(false);

  // Build the widget catalog once (each node is a themed glass tile).
  const items = useMemo(
    () =>
      ALL.map((kind) => {
        const [x, y, w, h] = GEO[kind] ?? [0, 40, 4, 5];
        const panel: PanelLayout = { i: kind, widget: kind, x, y, w, h };
        return { id: kind, x, y, w, h, node: <div className="vc-glass h-full overflow-hidden rounded-2xl">{renderWidget(panel, () => {})}</div> };
      }),
    [],
  );

  const iconBtn = "rounded-lg border border-white/12 p-2 text-muted transition hover:border-accent/50 hover:text-accent";

  return (
    <div className="vc-aurora vc-grid-texture relative flex h-screen flex-col bg-[var(--vc-bg)] text-ink">
      <header className="relative z-10 flex shrink-0 items-center gap-3 px-4 py-3">
        <img src="/market-bubble-logo.svg" alt="Market Bubble" className="h-24 w-auto" />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setThemeOpen(true)} title="Theme editor" className={iconBtn}><Palette size={16} /></button>
          <button onClick={() => setConnOpen(true)} title="Connections — platforms & OBS" className={iconBtn}><Plug size={16} /></button>
          <button
            onClick={toggleDemo}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${demo ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}
          >
            {demo ? "DEMO" : "LIVE"}
          </button>
          <button onClick={() => setAccount(true)} className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[13px] font-bold">
            {xHandle ? `@${xHandle}` : address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "Connect Wallet"}
          </button>
          <button
            onClick={() => setEdit((e) => !e)}
            title="Add tiles & rearrange your layout"
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-bold transition ${edit ? "border-accent bg-accent/15 text-accent" : "border-white/15 bg-white/[0.05] text-ink hover:border-accent/50 hover:text-accent"}`}
          >
            {edit ? <Eye size={15} /> : <Pencil size={15} />} {edit ? "Done" : "Edit"}
          </button>
          <button
            onClick={() => setUiMode("pro")}
            title="Full dashboard — markets, KOL, analytics & more"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-bold text-black shadow-neon"
          >
            <Zap size={14} /> Pro
          </button>
        </div>
      </header>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <Suspense fallback={null}>
          <PageGrid pageKey="simple-v1" items={items} editMode={edit} titles={TITLES} defaultHidden={DEFAULT_HIDDEN} />
        </Suspense>
      </main>

      {account && <AccountModal open={account} onClose={() => setAccount(false)} />}
      <Suspense fallback={null}>
        {connOpen && <ConnectionsManager open={connOpen} onClose={() => setConnOpen(false)} />}
        {themeOpen && <ThemeEditor open={themeOpen} onClose={() => setThemeOpen(false)} />}
      </Suspense>
    </div>
  );
}
