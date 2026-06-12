import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowUp, X, Sparkles } from "lucide-react";
import { FeaturesModal } from "./FeaturesModal";

const SEEN_KEY = "vibechat-onboarded-v1";

/**
 * First-run coaching for the Chat Only landing page:
 *   • the full Everything-Market-Bubble-Does features popup on first load
 *   • an animated arrow pointing at the ← Dashboard button
 *   • a tooltip under "Copy OBS URL" (how to use it in OBS)
 *   • a tooltip under the Demo / Live toggle (how to test it)
 *
 * Rendered via a portal to <body> so its fixed/absolute positions anchor to
 * the real viewport (the stage view has `contain`/transform ancestors that
 * would otherwise hijack fixed positioning). One plain `fixed inset-0`
 * container holds everything — no transform on it, so children anchor cleanly.
 */
export function OnboardingChrome({ demo }: { demo: boolean }) {
  const [features, setFeatures] = useState(false);
  const [hints, setHints] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try { seen = localStorage.getItem(SEEN_KEY); } catch { /* ignore */ }
    if (!seen) setFeatures(true);
    else setHints(true);
  }, []);

  const closeFeatures = () => {
    setFeatures(false);
    setHints(true);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  };

  const card = "pointer-events-auto absolute rounded-xl px-3 py-2.5 text-[12px] leading-snug shadow-[0_12px_34px_rgba(0,0,0,0.6)]";
  const cardStyle = { background: "#14100a", border: "1px solid rgba(217,165,71,0.45)", color: "#f3efe7", backdropFilter: "blur(6px)" } as const;

  return createPortal(
    <>
      <FeaturesModal open={features} onClose={closeFeatures} />

      <div className="pointer-events-none fixed inset-0 z-[55]">
        {/* Reopen-features pill (always available on the landing) */}
        <button
          onClick={() => setFeatures(true)}
          className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition hover:brightness-125"
          style={{ position: "absolute", background: "rgba(8,7,6,0.82)", border: "1px solid rgba(217,165,71,0.4)", color: "#e8c987", backdropFilter: "blur(6px)" }}
        >
          <Sparkles size={14} /> Features
        </button>

        {hints && (
          <>
            {/* Animated arrow pointing at the left Dashboard button (top-left) */}
            <motion.div
              className="absolute left-[34px] top-[52px]"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              style={{ color: "#d9a547" }}
            >
              <ArrowUp size={26} strokeWidth={3} />
            </motion.div>

            {/* Dashboard explainer */}
            <div className={`left-3 top-[88px] max-w-[230px] ${card}`} style={cardStyle}>
              <div className="mb-0.5 font-black uppercase tracking-wider" style={{ color: "#e8c987" }}>&larr; Dashboard</div>
              Opens the <b>full app</b> &mdash; unified chat, live markets &amp; KOL tracker, analytics, leaderboards and the layout editor.
            </div>

            {/* Copy OBS URL explainer */}
            <div className={`left-3 top-[168px] max-w-[250px] ${card}`} style={cardStyle}>
              <div className="mb-0.5 font-black uppercase tracking-wider" style={{ color: "#e8c987" }}>Copy OBS URL</div>
              This page <b>is your OBS source</b>. Copy the <span style={{ color: "#86ffd5" }}>Live</span> or <span style={{ color: "#e8c987" }}>Demo</span> URL, then in OBS go <b>Sources &rarr; + &rarr; Browser</b> and paste it.
            </div>

            {/* Demo / Live explainer (top-right) */}
            <div className={`right-3 top-[58px] max-w-[270px] ${card}`} style={cardStyle}>
              <div className="mb-0.5 font-black uppercase tracking-wider" style={{ color: "#e8c987" }}>Demo / Live</div>
              <b>Demo</b> runs a simulated stream so you can test every chat tool, the Interactive Overlay effects and User Points with <b>zero setup</b>. Flip to <b>Live</b> once your platforms are connected.
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setHints(false)}
              className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-black"
              style={{ position: "absolute", background: "#d9a547", color: "#14100a", boxShadow: "0 4px 14px rgba(217,165,71,0.4)" }}
            >
              <X size={13} /> Got it
            </button>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
