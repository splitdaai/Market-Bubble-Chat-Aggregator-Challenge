import { motion } from "framer-motion";
import { Palette, Pencil, Eye, RotateCcw, Monitor, Radio, BarChart3, Plug } from "lucide-react";
import { useLayoutStore } from "@/store/layoutStore";
import { useModeStore } from "@/store/modeStore";
import { useOverlayStore } from "@/store/overlayStore";
import { useViewStore } from "@/store/viewStore";
import { AudioControl } from "./AudioControl";
import { LiveTimer } from "./LiveTimer";

/** Top command bar — view tabs, edit-mode toggle, theme editor, sound, reset. */
export function Topbar({ onOpenTheme, onOpenConnections }: { onOpenTheme: () => void; onOpenConnections: () => void }) {
  const editMode = useLayoutStore((s) => s.editMode);
  const toggleEditMode = useLayoutStore((s) => s.toggleEditMode);
  const resetLayout = useLayoutStore((s) => s.resetLayout);
  const demo = useModeStore((s) => s.demo);
  const toggleDemo = useModeStore((s) => s.toggle);
  const overlayEnabled = useOverlayStore((s) => s.enabled);
  const toggleOverlay = useOverlayStore((s) => s.toggleEnabled);
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const isLive = view === "live";

  return (
    <header className="relative z-20 flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-accent/40 bg-accent/10 shadow-neon">
          <img
            src="/logo-white.png"
            alt="Market Bubble"
            className="h-7 w-7 object-contain"
            style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--vc-accent) 70%, transparent))" }}
          />
        </div>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold leading-none tracking-tight">
            Market <span className="text-accent">Bubble</span>
            <span className="flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
              Live
              <LiveTimer className="tabular-nums text-red-200/90" />
            </span>
          </h1>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
            Multi-Stream Market Chat {demo && "· Demo Mode"}
          </p>
        </div>
      </div>

      {/* view tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          onClick={() => setView("live")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${
            isLive ? "bg-accent/20 text-accent shadow-neon" : "text-muted hover:text-ink"
          }`}
        >
          <Radio size={14} className={isLive ? "animate-pulse-glow" : ""} /> Live
        </button>
        <button
          onClick={() => setView("analytics")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${
            !isLive ? "bg-accent/20 text-accent shadow-neon" : "text-muted hover:text-ink"
          }`}
        >
          <BarChart3 size={14} /> Analytics
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {isLive && (
          <div className="group relative">
            <button
              onClick={toggleDemo}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                demo ? "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${demo ? "bg-amber-400" : "bg-emerald-400"}`} />
              {demo ? "Demo" : "Live"}
            </button>
            {/* Guidance tooltip — nudges reviewers to go Live to connect real channels */}
            <div className="pointer-events-none absolute right-0 top-full z-[60] mt-2 w-56 rounded-lg border border-white/12 bg-black/90 px-3 py-2 text-left text-[11px] font-medium normal-case leading-snug tracking-normal text-white/90 opacity-0 shadow-xl backdrop-blur transition-opacity duration-150 group-hover:opacity-100">
              <span className="absolute -top-1 right-5 h-2 w-2 rotate-45 border-l border-t border-white/12 bg-black/90" />
              {demo
                ? "Demo data is on. Click to switch to Live — then connect your channels to test the real integration."
                : "You're Live. Open the 🔌 Connections panel to link your channels and test."}
            </div>
          </div>
        )}
        <AudioControl />
        <IconBtn onClick={onOpenConnections} title="Connections (platforms + OBS)">
          <Plug size={16} />
        </IconBtn>
        {isLive && (
          <IconBtn onClick={toggleOverlay} active={overlayEnabled} title="Viewer overlay (OBS)">
            <Monitor size={16} />
          </IconBtn>
        )}
        {isLive && editMode && (
          <IconBtn onClick={resetLayout} title="Reset layout">
            <RotateCcw size={16} />
          </IconBtn>
        )}
        <IconBtn onClick={onOpenTheme} title="Theme editor">
          <Palette size={16} />
        </IconBtn>

        {isLive && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggleEditMode}
            className={`ml-1 flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
              editMode
                ? "border-accent bg-accent/20 text-accent shadow-neon"
                : "border-white/15 bg-white/[0.04] text-ink hover:border-white/30"
            }`}
          >
            {editMode ? <Eye size={15} /> : <Pencil size={15} />}
            {editMode ? "Done" : "Edit"}
          </motion.button>
        )}
      </div>
    </header>
  );
}

function IconBtn({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
        active ? "border-accent/50 bg-accent/15 text-accent" : "border-white/10 bg-white/[0.03] text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
