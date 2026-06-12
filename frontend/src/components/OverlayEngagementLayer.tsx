import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { engageUrl, qrImageUrl, subscribeOverlayEvents, type OverlayEngagementEvent } from "@/lib/overlayEngagement";
import { compact } from "@/lib/format";

const TTL = 9000;
const METER_IDLE_MS = 5000;
const EVENT_FLUSH_MS = 80;
const MAX_EVENT_HISTORY = 16;
const HERO_COOLDOWN_MS = 2400;
const AUDIO_COOLDOWN_MS = 2200;
const HERO_ACTION_IDS = new Set(["charging-bull", "bear-slash"]);
const VISUAL_KIND_COOLDOWNS: Partial<Record<OverlayEngagementEvent["kind"], number>> = {
  color: 650,
  clip: 750,
  emote: 420,
  soundwave: 700,
  spotlight: 900,
  ticker: 120,
};
const BULL_ASSET = "/overlay-vfx/charging-bull.png";
const BEAR_ASSET = "/overlay-vfx/bear-slash.png";

let overlayAudioCtx: AudioContext | null = null;
let lastHeroAudioAt = 0;
type WebAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function EngagementQr({ room }: { room: string }) {
  const url = useMemo(() => engageUrl(room), [room]);
  return (
    <div className="absolute bottom-2 right-2 z-40 flex items-center gap-2 rounded-xl border border-[#d9a547]/35 bg-[#080706]/88 p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)] backdrop-blur">
      <img src={qrImageUrl(url, 92)} alt="Scan to control the Market Bubble overlay" className="h-[58px] w-[58px] rounded-md bg-white p-1" />
      <div className="hidden pr-1 sm:block">
        <div className="text-[9px] font-black uppercase leading-tight tracking-[0.14em] text-[#d9a547]">Scan to play</div>
        <div className="mt-0.5 max-w-[72px] text-[10px] font-bold leading-tight text-white/70">Spend Bubble Bucks</div>
      </div>
    </div>
  );
}

export function OverlayEngagementLayer({ room }: { room: string }) {
  const [events, setEvents] = useState<OverlayEngagementEvent[]>([]);
  const [votes, setVotes] = useState({ bull: 1, bear: 1 });
  const [boss, setBoss] = useState(100);
  const [meterPulse, setMeterPulse] = useState<{ side: "bull" | "bear"; at: number } | null>(null);
  const [meterVisible, setMeterVisible] = useState(false);
  const pendingEvents = useRef<OverlayEngagementEvent[]>([]);
  const flushTimer = useRef<number | null>(null);
  const lastVisualAt = useRef(new Map<string, number>());

  const clearOverlay = useCallback(() => {
    if (flushTimer.current !== null) {
      window.clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    pendingEvents.current = [];
    lastVisualAt.current.clear();
    setEvents([]);
    setVotes({ bull: 1, bear: 1 });
    setBoss(100);
    setMeterPulse(null);
    setMeterVisible(false);
  }, []);

  const flushPendingEvents = useCallback(() => {
    flushTimer.current = null;
    const batch = pendingEvents.current.splice(0, pendingEvents.current.length);
    if (!batch.length) return;

    const now = Date.now();
    let bullDelta = 0;
    let bearDelta = 0;
    let bossDamage = 0;
    let latestSide: "bull" | "bear" | null = null;
    const renderable: OverlayEngagementEvent[] = [];

    for (const event of batch) {
      const side = event.payload?.side;
      const count = eventCount(event);
      if (side === "bull") {
        bullDelta += count;
        latestSide = side;
      } else if (side === "bear") {
        bearDelta += count;
        latestSide = side;
      }
      if (event.kind === "boss") {
        bossDamage += event.payload?.damage ?? 12;
      }
      if (shouldRenderEvent(event, now, lastVisualAt.current)) {
        renderable.push(event);
      }
    }

    if (bullDelta || bearDelta) {
      setVotes((v) => ({ bull: v.bull + bullDelta, bear: v.bear + bearDelta }));
      setMeterPulse({ side: latestSide ?? "bull", at: now });
    }
    if (bossDamage > 0) {
      setBoss((hp) => Math.max(0, hp - bossDamage));
    }
    if (renderable.length) {
      const visualEvents = renderable.slice(-8);
      const hero = visualEvents.find((event) => HERO_ACTION_IDS.has(event.actionId));
      if (hero) playOverlayHeroSfx(hero);
      setEvents((prev) => [...visualEvents.reverse(), ...prev].slice(0, MAX_EVENT_HISTORY));
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current !== null) return;
    flushTimer.current = window.setTimeout(flushPendingEvents, EVENT_FLUSH_MS);
  }, [flushPendingEvents]);

  useEffect(() => {
    const unsub = subscribeOverlayEvents(room, (event) => {
      if (event.kind === "clear" || event.actionId === "clear-overlay") {
        clearOverlay();
        return;
      }
      pendingEvents.current.push(event);
      if (pendingEvents.current.length > 160) {
        pendingEvents.current.splice(0, pendingEvents.current.length - 160);
      }
      scheduleFlush();
    });
    return () => {
      unsub();
      if (flushTimer.current !== null) {
        window.clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      pendingEvents.current = [];
    };
  }, [clearOverlay, room, scheduleFlush]);

  useEffect(() => {
    if (!meterPulse) return;
    setMeterVisible(true);
    const t = window.setTimeout(() => setMeterVisible(false), METER_IDLE_MS);
    return () => window.clearTimeout(t);
  }, [meterPulse]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const cutoff = Date.now() - TTL;
      setEvents((prev) => prev.filter((e) => e.at > cutoff));
      setBoss((hp) => (hp <= 0 ? 100 : Math.min(100, hp + 1.5)));
    }, 900);
    return () => window.clearInterval(t);
  }, []);

  const visible = events.filter((e) => Date.now() - e.at < TTL);
  const tickerEvents = visible.filter((e) => e.kind === "ticker").slice(0, 6);
  const latestSpotlight = visible.find((e) => e.kind === "spotlight");
  const latestClip = visible.find((e) => e.kind === "clip");
  const latestSound = visible.find((e) => e.kind === "soundwave");
  const latestWave = visible.find((e) => e.kind === "color");
  const heroEvents = visible.filter((e) => HERO_ACTION_IDS.has(e.actionId)).slice(0, 2);
  const bullPct = Math.round((votes.bull / (votes.bull + votes.bear)) * 100);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <AnimatePresence initial={false}>
        {latestWave && <ColorWave key={latestWave.id} event={latestWave} />}
        {heroEvents.map((event) => <HeroAnimalEffect key={event.id} event={event} />)}
        {visible.filter((e) => e.kind === "emote").slice(0, 4).map((event) => <EmoteBurst key={event.id} event={event} />)}
        {latestSpotlight && <Spotlight key={latestSpotlight.id} event={latestSpotlight} />}
        {latestClip && <ClipBoost key={latestClip.id} event={latestClip} />}
        {latestSound && <Soundwave key={latestSound.id} event={latestSound} />}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {meterVisible && (
          <BullBearMeter
            key="bull-bear-meter"
            bullPct={bullPct}
            lastSide={meterPulse?.side ?? "bull"}
            pulseKey={meterPulse?.at ?? 0}
          />
        )}
      </AnimatePresence>
      <BossBar hp={boss} />
      {tickerEvents.length > 0 && <TickerTape events={tickerEvents} />}
    </div>
  );
}

function BullBearMeter({ bullPct, lastSide, pulseKey }: { bullPct: number; lastSide: "bull" | "bear"; pulseKey: number }) {
  const bearPct = 100 - bullPct;
  const leader = bullPct >= 50 ? "Bull" : "Bear";
  const accent = lastSide === "bull" ? "#16e6a4" : "#ff5c7a";
  return (
    <motion.div
      initial={{ opacity: 0, y: -18, scale: 0.94, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -10, scale: 0.97, filter: "blur(6px)" }}
      transition={{ type: "spring", stiffness: 190, damping: 22 }}
      className="absolute left-1/2 top-[54px] -translate-x-1/2 overflow-hidden rounded-[22px] border border-white/16 bg-[#050607]/72 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.55),0_0_34px_rgba(22,230,164,0.12)] backdrop-blur-md"
      style={{ width: "min(560px, calc(100vw - 24px))" }}
    >
      <motion.div
        key={pulseKey}
        className="absolute inset-[-1px] rounded-[22px]"
        initial={{ opacity: 0.9, boxShadow: `0 0 0 rgba(255,255,255,0), 0 0 58px ${accent}00` }}
        animate={{ opacity: [0.9, 0.35, 0], boxShadow: [`0 0 18px ${accent}66`, `0 0 54px ${accent}55`, `0 0 0 ${accent}00`] }}
        transition={{ duration: 1.05, ease: "easeOut" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.16),transparent_22%,transparent_76%,rgba(255,255,255,0.09))]" />
      <div className="relative mb-2 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#16e6a4]">Bull</span>
          <span className="text-2xl font-black tabular-nums text-white">{bullPct}%</span>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
          {leader} tilt
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tabular-nums text-white">{bearPct}%</span>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff5c7a]">Bear</span>
        </div>
      </div>
      <div className="relative h-9 overflow-hidden rounded-full bg-[#ff5c7a]/45 shadow-[inset_0_2px_8px_rgba(0,0,0,0.72),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-l-full bg-[linear-gradient(90deg,#067e66,#16e6a4,#b7ffe8)] shadow-[0_0_24px_rgba(22,230,164,0.45)]"
          animate={{ width: `${bullPct}%` }}
          transition={{ type: "spring", stiffness: 165, damping: 24 }}
        />
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-[linear-gradient(90deg,#ff8ca0,#ff5c7a,#7d1025)]" style={{ width: `${bearPct}%` }} />
        <motion.div
          key={`shine-${pulseKey}`}
          initial={{ x: "-115%", opacity: 0 }}
          animate={{ x: "215%", opacity: [0, 0.9, 0] }}
          transition={{ duration: 1.15, ease: "easeOut" }}
          className="absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.74),transparent)] blur-[1px]"
        />
        <motion.div
          className="absolute top-1/2 h-12 w-12 -translate-y-1/2 rounded-full border border-white/45 bg-white/18 shadow-[0_0_24px_rgba(255,255,255,0.38)] backdrop-blur"
          animate={{ left: `calc(${bullPct}% - 24px)` }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
        >
          <div className="absolute inset-[9px] rounded-full bg-white/85 shadow-[0_0_18px_rgba(255,255,255,0.45)]" />
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.33),transparent_42%,rgba(0,0,0,0.24))]" />
      </div>
      <div className="relative mt-2 grid grid-cols-3 items-center text-[10px] font-black uppercase tracking-[0.14em] text-white/48">
        <span>green pressure</span>
        <span className="text-center text-white/62">last hit: {lastSide}</span>
        <span className="text-right">red pressure</span>
      </div>
    </motion.div>
  );
}

function BossBar({ hp }: { hp: number }) {
  if (hp >= 99) return null;
  return (
    <div className="absolute left-1/2 top-[142px] w-[42%] -translate-x-1/2 rounded-xl border border-red-400/35 bg-black/55 p-2 backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-red-200">
        <span>FUD Boss</span><span>{compact(hp)} HP</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-red-950">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-300" animate={{ width: `${hp}%` }} />
      </div>
    </div>
  );
}

function HeroAnimalEffect({ event }: { event: OverlayEngagementEvent }) {
  return event.actionId === "charging-bull" ? <ChargingBull event={event} /> : <BearSlash event={event} />;
}

function ChargingBull({ event }: { event: OverlayEngagementEvent }) {
  const ticker = eventTicker(event);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: [0, -8, 7, -4, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      className="absolute inset-0 z-20 overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.38, 0] }}
        transition={{ duration: 0.52, ease: "easeOut" }}
        className="absolute inset-0 bg-[#16e6a4]/40 mix-blend-screen"
      />
      {Array.from({ length: 16 }, (_, i) => (
        <motion.span
          key={`${event.id}-speed-${i}`}
          initial={{ x: "-30vw", opacity: 0, scaleX: 0.25 }}
          animate={{ x: "118vw", opacity: [0, 0.82, 0], scaleX: [0.25, 1.15, 0.4] }}
          transition={{ duration: 0.9 + (i % 5) * 0.08, delay: i * 0.035, ease: "easeOut" }}
          className="absolute h-[3px] rounded-full bg-[linear-gradient(90deg,transparent,#d7fff2,#16e6a4,transparent)] blur-[0.5px]"
          style={{ top: `${18 + ((i * 11) % 64)}%`, left: "-18%", width: `${18 + (i % 4) * 8}%` }}
        />
      ))}
      <SonicBoom color="#16e6a4" side="bull" />
      <motion.img
        src={BULL_ASSET}
        alt=""
        draggable={false}
        initial={{ x: "-72vw", y: "26vh", opacity: 0, scale: 0.84, rotate: -1 }}
        animate={{ x: ["-72vw", "12vw", "112vw"], y: ["28vh", "18vh", "22vh"], opacity: [0, 1, 1, 0], scale: [0.84, 1.08, 1.1], rotate: [-1, 1.5, 0] }}
        transition={{ duration: 2.8, times: [0, 0.55, 1], ease: [0.12, 0.8, 0.18, 1] }}
        className="absolute h-[min(44vh,430px)] max-h-[430px] min-h-[210px] w-auto select-none drop-shadow-[0_24px_38px_rgba(0,0,0,0.62)]"
        style={{ filter: "contrast(1.08) saturate(1.12) drop-shadow(0 0 28px rgba(22,230,164,0.38))" }}
      />
      <HeroLabel event={event} title={`${ticker} bull charge`} color="#16e6a4" />
    </motion.div>
  );
}

function BearSlash({ event }: { event: OverlayEngagementEvent }) {
  const ticker = eventTicker(event);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: [0, 7, -8, 4, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      className="absolute inset-0 z-20 overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 0.42, ease: "easeOut" }}
        className="absolute inset-0 bg-[#ff5c7a]/42 mix-blend-screen"
      />
      <SonicBoom color="#ff5c7a" side="bear" />
      {Array.from({ length: 3 }, (_, i) => (
        <motion.span
          key={`${event.id}-claw-${i}`}
          initial={{ scaleX: 0, opacity: 0, x: "24vw" }}
          animate={{ scaleX: [0, 1, 1], opacity: [0, 1, 0], x: "-20vw" }}
          transition={{ duration: 0.62, delay: 0.45 + i * 0.055, ease: "easeOut" }}
          className="absolute left-[14%] h-[9px] w-[78%] origin-right rotate-[-17deg] rounded-full bg-[linear-gradient(90deg,transparent,#fff,#ff5c7a,#7d1025,transparent)] shadow-[0_0_28px_rgba(255,92,122,0.72)]"
          style={{ top: `${34 + i * 6}%` }}
        />
      ))}
      <motion.img
        src={BEAR_ASSET}
        alt=""
        draggable={false}
        initial={{ x: "110vw", y: "18vh", opacity: 0, scale: 0.9, rotate: 2 }}
        animate={{ x: ["110vw", "30vw", "-72vw"], y: ["20vh", "16vh", "24vh"], opacity: [0, 1, 1, 0], scale: [0.9, 1.08, 1.02], rotate: [2, -2, -4] }}
        transition={{ duration: 2.55, times: [0, 0.5, 1], ease: [0.12, 0.8, 0.18, 1] }}
        className="absolute h-[min(48vh,460px)] max-h-[460px] min-h-[220px] w-auto select-none drop-shadow-[0_24px_38px_rgba(0,0,0,0.66)]"
        style={{ filter: "contrast(1.08) saturate(1.12) drop-shadow(0 0 28px rgba(255,92,122,0.45))" }}
      />
      <HeroLabel event={event} title={`${ticker} bear slash`} color="#ff5c7a" />
    </motion.div>
  );
}

function SonicBoom({ color, side }: { color: string; side: "bull" | "bear" }) {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: 4 }, (_, i) => (
        <motion.span
          key={`${side}-ring-${i}`}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.5, 0], scale: [0.4, 1.55 + i * 0.28, 2.25 + i * 0.22] }}
          transition={{ duration: 1.35, delay: i * 0.16, ease: "easeOut" }}
          className="absolute top-[44%] h-28 w-28 rounded-full border"
          style={{
            borderColor: color,
            boxShadow: `0 0 28px ${color}`,
            left: side === "bull" ? `${18 + i * 10}%` : `${70 - i * 10}%`,
          }}
        />
      ))}
    </div>
  );
}

function HeroLabel({ event, title, color }: { event: OverlayEngagementEvent; title: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.94 }}
      animate={{ opacity: [0, 1, 1, 0], y: [18, 0, 0, -8], scale: [0.94, 1, 1, 0.98] }}
      transition={{ duration: 2.55, times: [0, 0.22, 0.78, 1], ease: "easeOut" }}
      className="absolute bottom-[76px] left-1/2 -translate-x-1/2 rounded-full border border-white/18 bg-black/70 px-5 py-2 text-center shadow-[0_18px_44px_rgba(0,0,0,0.58)] backdrop-blur"
      style={{ boxShadow: `0 18px 44px rgba(0,0,0,0.58), 0 0 28px ${color}55` }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color }}>{event.user}</div>
      <div className="text-lg font-black uppercase tracking-[0.12em] text-white">{title}</div>
    </motion.div>
  );
}

function TickerTape({ events }: { events: OverlayEngagementEvent[] }) {
  return (
    <div className="absolute bottom-2 left-2 right-[116px] flex min-w-0 gap-1.5 overflow-hidden">
      {events.map((event) => (
        <motion.div
          key={event.id}
          initial={{ y: 18, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          className="shrink-0 rounded-full border border-[#34d6ff]/45 bg-[#34d6ff]/12 px-3 py-1 text-[13px] font-black text-[#bdf2ff] shadow-[0_0_18px_rgba(52,214,255,0.22)]"
        >
          ${event.payload?.ticker ?? "BTC"} boosted by {event.user}
        </motion.div>
      ))}
    </div>
  );
}

function EmoteBurst({ event }: { event: OverlayEngagementEvent }) {
  const emote = event.payload?.emote ?? "🫧";
  const branded = brandedEmote(event.actionId);
  const count = event.actionId === "whale-storm" ? 34 : branded ? 20 : 18;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const seed = hash(`${event.id}-${i}`);
        const left = 8 + (seed % 84);
        const delay = (seed % 9) * 0.035;
        const size = 19 + (seed % 19);
        return (
          <motion.span
            key={`${event.id}-${i}`}
            initial={{ y: "105vh", x: 0, opacity: 0, rotate: -18 }}
            animate={{ y: "-16vh", x: ((seed % 40) - 20), opacity: [0, 1, 1, 0], rotate: 22 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3.2 + (seed % 7) * 0.18, delay, ease: "easeOut" }}
            className="absolute font-black drop-shadow-[0_3px_10px_rgba(0,0,0,0.65)]"
            style={{ left: `${left}%`, fontSize: size }}
          >
            {branded ? <BrandedEmoteChip brand={branded} seed={seed} /> : emote}
          </motion.span>
        );
      })}
    </>
  );
}

type BrandedEmote = { text: string; sub: string; bg: string; fg: string; glow: string; mark: string };

function brandedEmote(actionId: string): BrandedEmote | null {
  switch (actionId) {
    case "ansem-emote":
      return { text: "ANSEM", sub: "SOL", bg: "linear-gradient(135deg,#1b1204,#f59e0b)", fg: "#fff7ed", glow: "rgba(245,158,11,0.58)", mark: "A" };
    case "banks-emote":
      return { text: "BANKS", sub: "LIVE", bg: "linear-gradient(135deg,#04131d,#38bdf8)", fg: "#e0f7ff", glow: "rgba(56,189,248,0.58)", mark: "B" };
    case "nelk-emote":
      return { text: "NELK", sub: "FULL SEND", bg: "linear-gradient(135deg,#050505,#f8fafc)", fg: "#050505", glow: "rgba(248,250,252,0.48)", mark: "N" };
    case "happy-dad-emote":
      return { text: "HAPPY DAD", sub: "HARD SELTZER", bg: "linear-gradient(135deg,#1a1402,#facc15)", fg: "#151005", glow: "rgba(250,204,21,0.54)", mark: "HD" };
    case "polymarket-emote":
      return { text: "POLYMARKET", sub: "ODDS", bg: "linear-gradient(135deg,#03131f,#34d6ff)", fg: "#e0faff", glow: "rgba(52,214,255,0.55)", mark: "P" };
    default:
      return null;
  }
}

function BrandedEmoteChip({ brand, seed }: { brand: BrandedEmote; seed: number }) {
  const tilt = (seed % 18) - 9;
  return (
    <span
      className="inline-flex min-w-[74px] items-center gap-1.5 rounded-full border border-white/35 px-2.5 py-1 align-middle shadow-[0_10px_24px_rgba(0,0,0,0.38)]"
      style={{ background: brand.bg, color: brand.fg, boxShadow: `0 10px 24px rgba(0,0,0,0.38), 0 0 22px ${brand.glow}`, transform: `rotate(${tilt}deg)` }}
    >
      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/90 px-1 text-[9px] font-black leading-none text-black">{brand.mark}</span>
      <span className="leading-none">
        <span className="block whitespace-nowrap text-[11px] font-black tracking-normal">{brand.text}</span>
        <span className="block whitespace-nowrap text-[7px] font-black uppercase tracking-[0.12em] opacity-72">{brand.sub}</span>
      </span>
    </span>
  );
}

function ColorWave({ event }: { event: OverlayEngagementEvent }) {
  const color = event.payload?.color ?? "#d9a547";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: [0, 0.38, 0], scale: 1.45 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2.4, ease: "easeOut" }}
      className="absolute inset-[-20%] rounded-full blur-2xl"
      style={{ background: `radial-gradient(circle at 50% 50%, ${color}, transparent 58%)` }}
    />
  );
}

function Spotlight({ event }: { event: OverlayEngagementEvent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      className="absolute left-1/2 top-[112px] w-[72%] -translate-x-1/2 rounded-2xl border border-white/18 bg-black/70 p-3 text-center shadow-[0_20px_44px_rgba(0,0,0,0.58)] backdrop-blur"
    >
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d9a547]">Viewer Spotlight · {event.user}</div>
      <div className="mt-1 text-lg font-black leading-tight text-white">{event.payload?.message || "W stream."}</div>
    </motion.div>
  );
}

function ClipBoost({ event }: { event: OverlayEngagementEvent }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="absolute right-2 top-[64px] rounded-xl border border-orange-300/40 bg-orange-500/14 px-3 py-2 text-right shadow-[0_0_24px_rgba(249,115,22,0.22)] backdrop-blur"
    >
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-200">Clip Boost</div>
      <div className="text-sm font-black text-white">{event.user} marked this</div>
    </motion.div>
  );
}

function Soundwave({ event }: { event: OverlayEngagementEvent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="absolute bottom-[58px] left-1/2 flex -translate-x-1/2 items-end gap-1 rounded-full border border-violet-300/35 bg-violet-500/15 px-4 py-2 backdrop-blur"
    >
      {Array.from({ length: 18 }, (_, i) => (
        <motion.span
          key={`${event.id}-${i}`}
          className="block w-1 rounded-full bg-violet-200"
          animate={{ height: [8, 26 + ((i * 7) % 24), 10] }}
          transition={{ duration: 0.7, repeat: 3, delay: i * 0.025 }}
        />
      ))}
    </motion.div>
  );
}

function eventTicker(event: OverlayEngagementEvent): string {
  return event.payload?.ticker ?? "BTC";
}

function eventCount(event: OverlayEngagementEvent): number {
  const count = event.payload?.count;
  return typeof count === "number" && Number.isFinite(count) ? Math.max(1, Math.min(10_000, Math.round(count))) : 1;
}

function shouldRenderEvent(event: OverlayEngagementEvent, now: number, lastVisualAt: Map<string, number>): boolean {
  if (event.kind === "clear") return false;
  const isHero = HERO_ACTION_IDS.has(event.actionId);
  if (event.kind === "vote" && !isHero) return false;

  const visualKey = isHero ? "hero" : event.kind;
  const cooldown = isHero ? HERO_COOLDOWN_MS : VISUAL_KIND_COOLDOWNS[event.kind] ?? 250;
  const last = lastVisualAt.get(visualKey) ?? 0;
  if (now - last < cooldown) return false;
  lastVisualAt.set(visualKey, now);
  return true;
}

function playOverlayHeroSfx(event: OverlayEngagementEvent): void {
  try {
    const now = Date.now();
    if (now - lastHeroAudioAt < AUDIO_COOLDOWN_MS) return;
    lastHeroAudioAt = now;
    const ctx = getOverlayAudioContext();
    if (!ctx) return;
    void ctx.resume().catch(() => undefined);
    const start = ctx.currentTime + 0.03;
    if (event.actionId === "charging-bull") {
      playChargingBullSfx(ctx, start);
    } else {
      playBearSlashSfx(ctx, start);
    }
  } catch {
    // Audio is best-effort; OBS/browser autoplay policy can block it.
  }
}

function getOverlayAudioContext(): AudioContext | null {
  if (overlayAudioCtx) return overlayAudioCtx;
  const AudioCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
  if (!AudioCtor) return null;
  overlayAudioCtx = new AudioCtor();
  return overlayAudioCtx;
}

function createEffectMaster(ctx: AudioContext, start: number, duration: number, volume = 0.24): GainNode {
  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-18, start);
  limiter.knee.setValueAtTime(18, start);
  limiter.ratio.setValueAtTime(5, start);
  limiter.attack.setValueAtTime(0.005, start);
  limiter.release.setValueAtTime(0.18, start);
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(volume, start + 0.08);
  master.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  master.connect(limiter);
  limiter.connect(ctx.destination);
  window.setTimeout(() => master.disconnect(), (duration + 0.2) * 1000);
  return master;
}

function connectSpatial(ctx: AudioContext, input: AudioNode, output: AudioNode, startPan: number, endPan: number, start: number, duration: number): void {
  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(startPan, start);
  pan.pan.linearRampToValueAtTime(endPan, start + duration);
  input.connect(pan);
  pan.connect(output);
}

function playChargingBullSfx(ctx: AudioContext, start: number): void {
  const master = createEffectMaster(ctx, start, 2.75, 0.22);

  const rumble = ctx.createOscillator();
  const rumbleGain = ctx.createGain();
  rumble.type = "sawtooth";
  rumble.frequency.setValueAtTime(38, start);
  rumble.frequency.linearRampToValueAtTime(58, start + 1.4);
  rumbleGain.gain.setValueAtTime(0.0001, start);
  rumbleGain.gain.exponentialRampToValueAtTime(0.18, start + 0.16);
  rumbleGain.gain.exponentialRampToValueAtTime(0.0001, start + 2.55);
  rumble.connect(rumbleGain);
  connectSpatial(ctx, rumbleGain, master, -0.8, 0.85, start, 2.5);
  rumble.start(start);
  rumble.stop(start + 2.65);

  const whoosh = createNoiseSource(ctx, 2.15);
  const whooshFilter = ctx.createBiquadFilter();
  const whooshGain = ctx.createGain();
  whooshFilter.type = "bandpass";
  whooshFilter.frequency.setValueAtTime(420, start);
  whooshFilter.frequency.exponentialRampToValueAtTime(1550, start + 1.7);
  whooshFilter.Q.setValueAtTime(0.9, start);
  whooshGain.gain.setValueAtTime(0.0001, start);
  whooshGain.gain.linearRampToValueAtTime(0.11, start + 0.42);
  whooshGain.gain.exponentialRampToValueAtTime(0.0001, start + 2.1);
  whoosh.connect(whooshFilter);
  whooshFilter.connect(whooshGain);
  connectSpatial(ctx, whooshGain, master, -0.95, 0.95, start, 2.1);
  whoosh.start(start);
  whoosh.stop(start + 2.15);

  for (let i = 0; i < 7; i++) {
    scheduleThump(ctx, master, start + 0.18 + i * 0.24, -0.75 + i * 0.25, 88 - i * 4);
  }
}

function playBearSlashSfx(ctx: AudioContext, start: number): void {
  const master = createEffectMaster(ctx, start, 2.45, 0.23);

  const growl = ctx.createOscillator();
  const growlFilter = ctx.createBiquadFilter();
  const growlGain = ctx.createGain();
  growl.type = "sawtooth";
  growl.frequency.setValueAtTime(72, start);
  growl.frequency.exponentialRampToValueAtTime(38, start + 1.35);
  growlFilter.type = "lowpass";
  growlFilter.frequency.setValueAtTime(260, start);
  growlFilter.frequency.exponentialRampToValueAtTime(120, start + 1.35);
  growlGain.gain.setValueAtTime(0.0001, start);
  growlGain.gain.exponentialRampToValueAtTime(0.16, start + 0.12);
  growlGain.gain.exponentialRampToValueAtTime(0.0001, start + 1.65);
  growl.connect(growlFilter);
  growlFilter.connect(growlGain);
  connectSpatial(ctx, growlGain, master, 0.85, -0.85, start, 1.65);
  growl.start(start);
  growl.stop(start + 1.75);

  const rush = createNoiseSource(ctx, 1.35);
  const rushFilter = ctx.createBiquadFilter();
  const rushGain = ctx.createGain();
  rushFilter.type = "highpass";
  rushFilter.frequency.setValueAtTime(360, start);
  rushFilter.frequency.exponentialRampToValueAtTime(2100, start + 0.9);
  rushGain.gain.setValueAtTime(0.0001, start);
  rushGain.gain.linearRampToValueAtTime(0.13, start + 0.2);
  rushGain.gain.exponentialRampToValueAtTime(0.0001, start + 1.25);
  rush.connect(rushFilter);
  rushFilter.connect(rushGain);
  connectSpatial(ctx, rushGain, master, 0.9, -0.9, start, 1.25);
  rush.start(start);
  rush.stop(start + 1.35);

  for (let i = 0; i < 3; i++) {
    scheduleSlash(ctx, master, start + 0.46 + i * 0.11, 0.75 - i * 0.35);
  }
  scheduleThump(ctx, master, start + 0.9, -0.15, 54);
}

function scheduleThump(ctx: AudioContext, output: AudioNode, when: number, panValue: number, frequency: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, when);
  osc.frequency.exponentialRampToValueAtTime(32, when + 0.16);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.2, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.17);
  osc.connect(gain);
  connectSpatial(ctx, gain, output, panValue, panValue + 0.08, when, 0.17);
  osc.start(when);
  osc.stop(when + 0.2);
}

function scheduleSlash(ctx: AudioContext, output: AudioNode, when: number, startPan: number): void {
  const noise = createNoiseSource(ctx, 0.22);
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(1100, when);
  filter.frequency.exponentialRampToValueAtTime(4300, when + 0.13);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.19, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
  noise.connect(filter);
  filter.connect(gain);
  connectSpatial(ctx, gain, output, startPan, startPan - 0.85, when, 0.2);
  noise.start(when);
  noise.stop(when + 0.22);
}

function createNoiseSource(ctx: AudioContext, duration: number): AudioBufferSourceNode {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
