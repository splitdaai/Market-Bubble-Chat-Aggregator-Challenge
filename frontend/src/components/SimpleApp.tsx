import { lazy, Suspense, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plug, Palette, Pencil, Eye, Wallet } from "lucide-react";
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
const UserCard = lazy(() => import("./UserCard").then((m) => ({ default: m.UserCard })));

// Default placement + size for each addable widget on the Simple canvas.
const GEO: Record<string, [number, number, number, number]> = {
  // Stream + chat fill the viewport by default (the clean stock layout) —
  // theater proportions: big stream (~75%), slim chat rail (~25%).
  "stream-preview": [0, 0, 9, 16],
  "chat-feed": [9, 0, 3, 16],
  stats: [0, 16, 4, 5],
  "top-chatters": [4, 16, 4, 7],
  polymarket: [8, 16, 4, 8],
  "user-list": [0, 21, 4, 7],
  clips: [4, 23, 4, 6],
  giveaway: [8, 24, 4, 7],
  "hype-meter": [0, 28, 4, 4],
  "mood-meter": [4, 29, 4, 4],
  "connection-status": [8, 31, 4, 4],
  "clip-radar": [0, 32, 4, 5],
  "button-deck": [4, 33, 4, 4],
  ops: [0, 37, 6, 6],
};

const ALL = Object.keys(WIDGET_META) as WidgetKind[];
// Every Pro widget is available; only the stream + chat show by default.
const DEFAULT_HIDDEN = ALL.filter((k) => k !== "stream-preview" && k !== "chat-feed");
const TITLES = Object.fromEntries(ALL.map((k) => [k, WIDGET_META[k].label]));

/** Icon button with a springy label that pops out on hover. */
function IconPop({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        onClick={onClick}
        className={`grid h-9 w-9 place-items-center rounded-xl border transition ${active ? "border-accent/60 bg-accent/15 text-accent" : "border-white/12 bg-white/[0.03] text-muted hover:border-accent/50 hover:text-accent"}`}
      >
        {icon}
      </button>
      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 540, damping: 24 }}
            className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-accent/40 bg-[#0b0b0b] px-2.5 py-1 text-[11px] font-bold text-accent shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
          >
            <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-accent/40 bg-[#0b0b0b]" />
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

  const walletLabel = xHandle ? `@${xHandle}` : address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "Wallet Connect";

  return (
    <div className="vc-aurora vc-grid-texture relative flex h-screen flex-col bg-[var(--vc-bg)] text-ink">
      <header className="relative z-10 flex shrink-0 items-center gap-3 px-4 py-3">
        <img src="/market-bubble-logo.svg" alt="Market Bubble" className="h-24 w-auto" />
        <div className="ml-auto flex items-center gap-2">
          {/* DEMO sits at the far-left of the button cluster */}
          <button
            onClick={toggleDemo}
            className={`mr-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${demo ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}
          >
            {demo ? "DEMO" : "LIVE"}
          </button>
          <IconPop icon={<Palette size={16} />} label="Theme Editor" onClick={() => setThemeOpen(true)} />
          <IconPop icon={<Plug size={16} />} label="Connections" onClick={() => setConnOpen(true)} />
          <IconPop icon={<Wallet size={16} />} label={walletLabel} onClick={() => setAccount(true)} active={!!(xHandle || address)} />
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
          <PageGrid pageKey="simple-v2" items={items} editMode={edit} titles={TITLES} defaultHidden={DEFAULT_HIDDEN} />
        </Suspense>
      </main>

      {account && <AccountModal open={account} onClose={() => setAccount(false)} />}
      <Suspense fallback={null}>
        <UserCard />
        {connOpen && <ConnectionsManager open={connOpen} onClose={() => setConnOpen(false)} />}
        {themeOpen && <ThemeEditor open={themeOpen} onClose={() => setThemeOpen(false)} />}
      </Suspense>
    </div>
  );
}
