import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useTourStore } from "@/store/tourStore";
import {X, Sparkles, MessagesSquare, Activity, BarChart3, Trophy, Monitor, Flame,
  Wallet, Gift, Scissors, Film, ShieldCheck, Palette, LayoutGrid, Users,
  Crosshair, LineChart, Star, Calculator, AtSign, Play } from "lucide-react";

/** One feature card's data. `tint` drives the icon chip + hover glow color. */
type Feature = { icon: typeof Sparkles; title: string; desc: string; tint: string };

const FEATURES: Feature[] = [
  { icon: MessagesSquare, title: "Unified Chat", desc: "Twitch, YouTube, Kick & X chat merged into one live, color-coded feed.", tint: "#16e6a4" },
  { icon: AtSign, title: "Chat as You", desc: "Connect your X account and post into the unified feed as your own handle.", tint: "#1d9bf0" },
  { icon: Crosshair, title: "KOL Tracker", desc: "Top crypto KOLs' wallets — balances, holdings, a live buy/sell firehose & their X posts.", tint: "#fb923c" },
  { icon: LineChart, title: "Market Terminal", desc: "Live global markets, narratives, TradingView technicals & deep-dive trader/portfolio dashboards.", tint: "#16e6a4" },
  { icon: Star, title: "Watchlist", desc: "Star any asset, trader, portfolio or KOL — saved to your connected account.", tint: "#fbbf24" },
  { icon: Calculator, title: "Watchlist Dashboard", desc: "Model your watchlist: combined P&L, performance graph & a 'what if I'd bought on…' calculator.", tint: "#34d6ff" },
  { icon: Users, title: "Multi-Account", desc: "Link up to 5 accounts per platform — every channel aggregates together.", tint: "#34d6ff" },
  { icon: Activity, title: "Live Stats", desc: "Real-time viewers, watch time & message velocity, per platform & combined.", tint: "#22d3ee" },
  { icon: BarChart3, title: "Analytics", desc: "Historical sessions: revenue, subs as $, trend lines & time filters.", tint: "#a78bfa" },
  { icon: Trophy, title: "Leaderboards", desc: "Top chatters, spenders & sub-funders ranked across all platforms.", tint: "#fbbf24" },
  { icon: Sparkles, title: "Bubble Bucks", desc: "Watch-&-earn chat points — earned per minute watched, per message, per sub & per $ supported; ranked on the leaderboard.", tint: "#d9a547" },
  { icon: Play, title: "Chat Only (on-stream)", desc: "The aggregated chat as a broadcast-clean panel for the center of the stream — per-streamer viewer counts, platform split on hover.", tint: "#d9a547" },
  { icon: Monitor, title: "OBS Integration", desc: "Drop Chat Only or a live overlay in as a browser source, or dock the full panel inside OBS.", tint: "#60a5fa" },
  { icon: Flame, title: "Polymarket", desc: "Live prediction markets — trending & breaking — placeable as an overlay.", tint: "#fb7185" },
  { icon: Wallet, title: "EVM Tipping", desc: "Non-custodial USDC/USDT tips to viewers who've linked a wallet.", tint: "#34d399" },
  { icon: Gift, title: "Giveaway Bot", desc: "One keyword, every platform enters, the bot draws a winner.", tint: "#f472b6" },
  { icon: Scissors, title: "Clip Radar", desc: "Auto-detects hype moments from chat-velocity spikes for instant clips.", tint: "#facc15" },
  { icon: Film, title: "Past Broadcasts", desc: "Browse VODs and replay them in the preview with a scrubber.", tint: "#38bdf8" },
  { icon: ShieldCheck, title: "Moderation", desc: "Ban, timeout & shield viewers from a per-user menu across platforms.", tint: "#4ade80" },
  { icon: Palette, title: "Theme Editor", desc: "Live-edit accent, glow, font & bubble style — with preset themes.", tint: "#c084fc" },
  { icon: LayoutGrid, title: "Layout Editor", desc: "Drag-resize every widget; your layout persists across refreshes.", tint: "#2dd4bf" },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.1 } },
};
const card: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 24 } },
};

export function FeaturesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] grid place-items-center overflow-x-hidden overflow-y-auto bg-black/60 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="vc-glass relative max-h-[90vh] w-full max-w-[680px] overflow-y-auto overflow-x-hidden p-6"
            initial={{ scale: 0.92, y: 22, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* animated accent glow sweeping behind the header */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[140%] -translate-x-1/2 opacity-40 blur-3xl"
              style={{ background: "radial-gradient(60% 100% at 50% 0%, var(--vc-accent), transparent 70%)" }}
              animate={{ opacity: [0.25, 0.5, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-widest text-accent">
                <motion.span
                  animate={{ rotate: [0, 14, -10, 0], scale: [1, 1.18, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles size={18} />
                </motion.span>
                Everything Market Bubble Does
              </h2>
              <button onClick={onClose} className="text-muted transition hover:text-ink" title="Close">
                <X size={20} />
              </button>
            </div>
            <p className="relative mb-3 text-xs text-muted">
              One dashboard for every stream — chat, stats, money, and moments, aggregated live.
            </p>
            <button
              onClick={() => { onClose(); useTourStore.getState().start(); }}
              className="relative mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/12 px-3 py-2.5 text-[13px] font-bold text-accent transition hover:bg-accent/20"
            >
              <Play size={14} /> Take the 60-second tour — see it all live
            </button>

            <motion.div
              className="relative grid grid-cols-1 gap-3 sm:grid-cols-2"
              variants={container}
              initial="hidden"
              animate="show"
            >
              {FEATURES.map((f) => (
                <motion.div
                  key={f.title}
                  variants={card}
                  whileHover={{ y: -4, scale: 1.025 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className="group relative flex items-start gap-3 overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-3"
                  style={{ ["--tint" as string]: f.tint }}
                >
                  {/* hover wash in the feature's tint */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: "radial-gradient(120% 120% at 0% 0%, color-mix(in srgb, var(--tint) 16%, transparent), transparent 60%)" }}
                  />
                  <span
                    className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                    style={{
                      color: "var(--tint)",
                      borderColor: "color-mix(in srgb, var(--tint) 35%, transparent)",
                      background: "color-mix(in srgb, var(--tint) 12%, transparent)",
                    }}
                  >
                    <f.icon size={18} />
                  </span>
                  <div className="relative">
                    <h3 className="text-sm font-bold text-ink">{f.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <div className="relative mt-5 flex items-center justify-center">
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="rounded-xl border border-accent/50 bg-accent/15 px-5 py-2 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/25"
              >
                Let's go →
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
