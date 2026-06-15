import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { useViewStore, type View } from "@/store/viewStore";
import { useTourStore } from "@/store/tourStore";
import { OverlayEngagementLayer } from "./OverlayEngagementLayer";
import { publishOverlayEvent, actionById, ENGAGE_ROOM } from "@/lib/overlayEngagement";

/**
 * The 60-second Judge Tour — a non-blocking guided walkthrough that drives the
 * real app (switches tabs under the card) and narrates the working core in 8
 * short steps. Launched from the Features popup or by visiting `?tour`.
 */

const SECONDS_PER_STEP = 8;

const STEPS: { view: View; title: string; body: string; overlay?: boolean }[] = [
  { view: "live", title: "One feed. Every platform.", body: "Twitch, Kick, X and YouTube chat aggregated live into a single feed — source badges, real emotes (7TV/BTTV/FFZ), auto-mod, and search. Demo mode simulates the trio; flip to LIVE for real connectors." },
  { view: "live", title: "Mod everyone, everywhere", body: "Click any chatter for their cross-platform profile — ban or timeout them on every platform at once. Banned-word automod protects hosts in real time." },
  { view: "live", title: "Broadcast-native market context", body: "Live Polymarket odds (gold bars, OBS-overlayable), Chat Vibe sentiment + most-spammed words, giveaways with auto-draw, and clip-moment detection — all running off the live chat stream." },
  { view: "live", overlay: true, title: "Interactive Overlay", body: "Viewers scan a QR and spend User Points to fire real on-screen effects — watch a charging bull stampede and a green candle rip across the stream right now. Plus bull/bear votes, emote storms and a FUD boss, all viewer-controlled in Live or Demo." },
  { view: "analytics", title: "User Points (Bubble Bucks)", body: "Watch-&-earn points: earned per minute watched, per message, per sub and per dollar supported — then spent on the Interactive Overlay. Ranked on the Bubble Bucks leaderboards and shown right in chat." },
  { view: "market", title: "Real markets, zero mockups", body: "Crypto + indices + commodities live (with automatic failover so the board never blanks), real Hyperliquid trader leaderboards & vaults by TVL, and real headlines from CoinDesk/Cointelegraph/Decrypt — sentiment-scored." },
  { view: "kol", title: "KOL smart-money tracker", body: "Top Hyperliquid wallets — filtered to accounts that are actually active. Click one: live account value chart, open positions, and recent fills with realized PnL. All on-chain, all real." },
  { view: "analytics", title: "The full revenue picture", body: "Viewers, watch time, chatters, new followers — plus every revenue stream connected: bits, subs, Kicks, Super Chats, memberships, crypto tips, and estimated ad revenue tied to ads actually shown." },
  { view: "live", title: "Built for OBS", body: "Hit \"Chat Only\" in the header — the aggregated chat as a broadcast-clean panel made to sit center-screen between the hosts, with per-streamer viewer counts (hover for the platform split). Plus a viewer overlay (browser source) and a full control dock — copyable URLs in Connections." },
  { view: "live", title: "Honest demo, real wiring", body: "Everything you just saw runs in demo without keys — and the live mode behind it is genuinely wired: anonymous Twitch/Kick readers, OAuth for YouTube/X, watch-any-channel, X-login chat + non-custodial tipping." },
];

export function JudgeTour() {
  const { active, step, stop, setStep } = useTourStore();
  const setView = useViewStore((s) => s.setView);
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);

  // Drive the real app: each step lands on its tab.
  useEffect(() => {
    if (!active) return;
    setView(STEPS[step].view);
  }, [active, step, setView]);

  // On the Interactive Overlay step, actually fire a charging bull + green
  // candle so the judge sees the effects live (the layer is mounted below).
  useEffect(() => {
    if (!active || !STEPS[step]?.overlay) return;
    const fire = (id: string) => {
      const a = actionById(id);
      if (!a) return;
      publishOverlayEvent({ room: ENGAGE_ROOM, actionId: a.id, kind: a.kind, label: a.label, user: "Judge Tour", cost: 0, payload: { side: "bull", color: a.accent } });
    };
    const t1 = window.setTimeout(() => fire("charging-bull"), 600);
    const t2 = window.setTimeout(() => fire("chart-pump"), 2600);
    const t3 = window.setTimeout(() => fire("charging-bull"), 4800);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
  }, [active, step]);

  // Auto-advance with a visible progress bar; pause-free, judges can override.
  useEffect(() => {
    if (!active) return;
    setProgress(0);
    const t0 = Date.now();
    timer.current = window.setInterval(() => {
      const p = (Date.now() - t0) / (SECONDS_PER_STEP * 1000);
      if (p >= 1) {
        if (step < STEPS.length - 1) setStep(step + 1);
        else stop();
      } else setProgress(p);
    }, 100);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [active, step, setStep, stop]);

  return (
    <>
    {active && STEPS[step]?.overlay && (
      <div className="pointer-events-none fixed inset-0 z-[68]">
        {/* Pushed below the dashboard Topbar (~h-28 logo + padding) so the vote
            meter never overlaps the nav during the judge tour. */}
        <OverlayEngagementLayer room={ENGAGE_ROOM} meterTop={150} />
      </div>
    )}
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed bottom-5 left-1/2 z-[70] w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-2xl border border-accent/30 bg-[#0d0d0c]/95 shadow-[0_18px_60px_rgba(0,0,0,0.6),0_0_30px_color-mix(in_srgb,var(--vc-accent)_18%,transparent)] backdrop-blur-md"
        >
          {/* progress */}
          <div className="h-0.5 w-full bg-white/8">
            <div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">60-second tour · {step + 1}/{STEPS.length}</span>
              <button onClick={stop} className="ml-auto rounded p-1 text-muted transition hover:text-ink"><X size={15} /></button>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.18 }}>
                <div className="serif text-[17px] font-bold text-ink">{STEPS[step].title}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{STEPS[step].body}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <button key={i} onClick={() => setStep(i)} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-accent" : "w-1.5 bg-white/20 hover:bg-white/40"}`} />
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {step > 0 && (
                  <button onClick={() => setStep(step - 1)} className="flex items-center gap-0.5 rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] font-bold text-muted transition hover:text-ink">
                    <ChevronLeft size={13} /> Back
                  </button>
                )}
                <button
                  onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : stop())}
                  className="flex items-center gap-0.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-black shadow-neon transition hover:opacity-90"
                >
                  {step < STEPS.length - 1 ? <>Next <ChevronRight size={13} /></> : "Done — explore!"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
