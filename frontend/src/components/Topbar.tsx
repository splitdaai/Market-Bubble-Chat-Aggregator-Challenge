import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Pencil, Eye, RotateCcw, Monitor, Radio, BarChart3, Plug, Sparkles, MousePointerClick, X } from "lucide-react";
import { useLayoutStore } from "@/store/layoutStore";
import { useModeStore } from "@/store/modeStore";
import { useOverlayStore } from "@/store/overlayStore";
import { useViewStore } from "@/store/viewStore";
import { AudioControl } from "./AudioControl";
import { LiveTimer } from "./LiveTimer";

/** Top command bar — view tabs, edit-mode toggle, theme editor, sound, reset. */
export function Topbar({ onOpenTheme, onOpenConnections, onOpenFeatures }: { onOpenTheme: () => void; onOpenConnections: () => void; onOpenFeatures: () => void }) {
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

  // Proactive nudge on the Demo/Live toggle — dismissed once the user clicks it
  // (or the ✕). Session-only so a fresh load shows it again for the next viewer.
  // Shown in BOTH Live and Analytics views (the toggle drives data everywhere).
  const [hintDismissed, setHintDismissed] = useState(false);
  const showDemoHint = !hintDismissed;
  const onToggleDemo = () => { toggleDemo(); setHintDismissed(true); };

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
        {/* Eye-catching feature tour launcher — animated gradient pill */}
        <motion.button
          onClick={onOpenFeatures}
          title="Click to learn about every feature"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          animate={{
            boxShadow: [
              "0 0 0px rgba(var(--vc-accent-rgb), 0)",
              "0 0 18px rgba(var(--vc-accent-rgb), 0.55)",
              "0 0 0px rgba(var(--vc-accent-rgb), 0)",
            ],
          }}
          transition={{ boxShadow: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } }}
          className="relative mr-1 hidden items-center gap-1.5 overflow-hidden rounded-xl border border-accent/60 px-3 py-2 text-[13px] font-extrabold text-[#04100c] md:flex"
          style={{ background: "linear-gradient(110deg, var(--vc-accent), var(--vc-accent2))" }}
        >
          {/* shimmer sweep */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.6) 50%, transparent 65%)" }}
            initial={{ x: "-130%" }}
            animate={{ x: "150%" }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
          />
          <motion.span
            className="relative"
            animate={{ rotate: [0, 16, -10, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles size={15} />
          </motion.span>
          <span className="relative whitespace-nowrap">Click to Learn Features</span>
        </motion.button>

        <div className="relative">
            <motion.button
              onClick={onToggleDemo}
              whileTap={{ scale: 0.94 }}
              animate={showDemoHint ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={showDemoHint ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                demo ? "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
              }`}
            >
              <span className={`relative flex h-1.5 w-1.5`}>
                {showDemoHint && (
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${demo ? "bg-amber-400/70" : "bg-emerald-400/70"}`} />
                )}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${demo ? "bg-amber-400" : "bg-emerald-400"}`} />
              </span>
              {demo ? "Demo" : "Live"}
            </motion.button>

            {/* Proactive animated reminder: floats, glows, and points at the toggle */}
            <AnimatePresence>
              {showDemoHint && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="absolute right-0 top-full z-[70] mt-2.5 w-64"
                >
                  <motion.div
                    animate={{
                      y: [0, -3.5, 0],
                      boxShadow: [
                        "0 0 0px rgba(var(--vc-accent-rgb),0)",
                        "0 0 20px rgba(var(--vc-accent-rgb),0.45)",
                        "0 0 0px rgba(var(--vc-accent-rgb),0)",
                      ],
                    }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    className="relative rounded-xl border border-accent/45 bg-black/90 px-3 py-2.5 text-left backdrop-blur"
                  >
                    {/* caret pointing up at the toggle */}
                    <span className="absolute -top-1.5 right-7 h-3 w-3 rotate-45 border-l border-t border-accent/45 bg-black/90" />
                    <button
                      onClick={() => setHintDismissed(true)}
                      title="Got it"
                      className="absolute right-1.5 top-1.5 text-white/40 transition hover:text-white"
                    >
                      <X size={11} />
                    </button>
                    <div className="flex items-start gap-2 pr-3">
                      <motion.span
                        className="mt-0.5 shrink-0 text-accent"
                        animate={{ scale: [1, 0.75, 1], rotate: [0, -10, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <MousePointerClick size={16} />
                      </motion.span>
                      <p className="text-[11px] font-medium normal-case leading-snug tracking-normal text-white/90">
                        {demo ? (
                          <>You're viewing <b className="text-amber-300">demo data</b>. Click to switch to <b className="text-emerald-300">Live</b> and aggregate your real channels.</>
                        ) : (
                          <>You're <b className="text-emerald-300">Live</b> on real data. Click anytime for <b className="text-amber-300">demo data</b>.</>
                        )}
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
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
