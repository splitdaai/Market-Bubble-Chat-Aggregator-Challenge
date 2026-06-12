import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { engageUrl, qrImageUrl, subscribeOverlayEvents, type OverlayEngagementEvent } from "@/lib/overlayEngagement";

const TTL = 9000;
const METER_IDLE_MS = 5000;
const EVENT_FLUSH_MS = 80;
const MAX_EVENT_HISTORY = 16;
const HERO_COOLDOWN_MS = 2400;
const AUDIO_COOLDOWN_MS = 2200;
const HERO_ACTION_IDS = new Set(["charging-bull", "bear-slash", "chart-pump", "chart-dump"]);
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
      if (shouldRenderEvent(event, now, lastVisualAt.current)) {
        renderable.push(event);
      }
    }

    if (bullDelta || bearDelta) {
      setVotes((v) => ({ bull: v.bull + bullDelta, bear: v.bear + bearDelta }));
      setMeterPulse({ side: latestSide ?? "bull", at: now });
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
        {heroEvents.map((event) => <HeroEffect key={event.id} event={event} />)}
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
      {tickerEvents.length > 0 && <TickerTape events={tickerEvents} />}
    </div>
  );
}

function BullBearMeter({ bullPct, lastSide, pulseKey }: { bullPct: number; lastSide: "bull" | "bear"; pulseKey: number }) {
  const bearPct = 100 - bullPct;
  const accent = lastSide === "bull" ? "#16e6a4" : "#ff5c7a";
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.99 }}
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      className="absolute left-1/2 top-[58px] -translate-x-1/2 overflow-hidden rounded-xl border border-white/12 bg-[#050607]/82 px-3.5 py-2 shadow-[0_16px_44px_rgba(0,0,0,0.48)] backdrop-blur-md"
      style={{ width: "min(440px, calc(100vw - 28px))" }}
    >
      <motion.div
        key={pulseKey}
        className="absolute inset-0"
        initial={{ opacity: 0.32 }}
        animate={{ opacity: [0.32, 0.12, 0] }}
        transition={{ duration: 0.85, ease: "easeOut" }}
        style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }}
      />
      <div className="relative flex items-center gap-3">
        <div className="w-[74px] text-left">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#16e6a4]">Bull</div>
          <div className="text-xl font-black leading-none tabular-nums text-white">{bullPct}%</div>
        </div>
        <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-[#ff5c7a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),inset_0_2px_8px_rgba(0,0,0,0.45)]">
          <motion.div
            className="absolute inset-y-0 left-0 bg-[#16e6a4] shadow-[0_0_18px_rgba(22,230,164,0.45)]"
            animate={{ width: `${bullPct}%` }}
            transition={{ type: "spring", stiffness: 210, damping: 25 }}
          />
          <motion.div
            className="absolute top-0 h-full w-[3px] bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.72)]"
            animate={{ left: `calc(${bullPct}% - 1.5px)` }}
            transition={{ type: "spring", stiffness: 210, damping: 25 }}
          />
          <motion.div
            key={`meter-scan-${pulseKey}`}
            initial={{ x: "-110%", opacity: 0 }}
            animate={{ x: "210%", opacity: [0, 0.75, 0] }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="absolute inset-y-0 w-16 skew-x-[-18deg] bg-white/50"
          />
        </div>
        <div className="w-[74px] text-right">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ff5c7a]">Bear</div>
          <div className="text-xl font-black leading-none tabular-nums text-white">{bearPct}%</div>
        </div>
      </div>
    </motion.div>
  );
}

function HeroEffect({ event }: { event: OverlayEngagementEvent }) {
  switch (event.actionId) {
    case "charging-bull":
      return <ChargingBull event={event} />;
    case "bear-slash":
      return <BearSlash event={event} />;
    case "chart-pump":
      return <ChartCandleBurst event={event} side="bull" />;
    case "chart-dump":
      return <ChartCandleBurst event={event} side="bear" />;
    default:
      return null;
  }
}

function ChargingBull({ event }: { event: OverlayEngagementEvent }) {
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
      <ShockStreaks color="#16e6a4" side="bull" />
      <motion.img
        src={BULL_ASSET}
        alt=""
        draggable={false}
        initial={{ x: "-72vw", y: "26vh", opacity: 0, scale: 0.84, rotate: -1 }}
        animate={{ x: ["-72vw", "12vw", "112vw"], y: ["28vh", "18vh", "22vh"], opacity: [0, 1, 1, 0], scale: [0.84, 1.08, 1.1], rotate: [-1, 1.5, 0] }}
        transition={{ duration: 2.8, times: [0, 0.55, 1], ease: [0.12, 0.8, 0.18, 1] }}
        className="absolute left-0 h-[min(44vh,430px)] max-h-[430px] min-h-[210px] w-auto select-none drop-shadow-[0_24px_38px_rgba(0,0,0,0.62)]"
        style={{ filter: "contrast(1.08) saturate(1.12) drop-shadow(0 0 28px rgba(22,230,164,0.38))" }}
      />
      <HeroLabel event={event} title="Bull charge" color="#16e6a4" />
    </motion.div>
  );
}

function BearSlash({ event }: { event: OverlayEngagementEvent }) {
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
      <ShockStreaks color="#ff5c7a" side="bear" />
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
        initial={{ x: "74vw", y: "18vh", opacity: 0, scale: 0.9, rotate: 2 }}
        animate={{ x: ["74vw", "-16vw", "-112vw"], y: ["20vh", "16vh", "24vh"], opacity: [0, 1, 1, 0], scale: [0.9, 1.08, 1.02], rotate: [2, -2, -4] }}
        transition={{ duration: 2.55, times: [0, 0.5, 1], ease: [0.12, 0.8, 0.18, 1] }}
        className="absolute right-0 h-[min(48vh,460px)] max-h-[460px] min-h-[220px] w-auto select-none drop-shadow-[0_24px_38px_rgba(0,0,0,0.66)]"
        style={{ filter: "contrast(1.08) saturate(1.12) drop-shadow(0 0 28px rgba(255,92,122,0.45))" }}
      />
      <HeroLabel event={event} title="Bear slash" color="#ff5c7a" />
    </motion.div>
  );
}

function ChartCandleBurst({ event, side }: { event: OverlayEngagementEvent; side: "bull" | "bear" }) {
  const ticker = eventTicker(event);
  const isBull = side === "bull";
  const color = isBull ? "#16e6a4" : "#ff3f5f";
  const glow = isBull ? "rgba(22,230,164,0.58)" : "rgba(255,63,95,0.58)";
  const path = isBull
    ? "M24 280 C104 254 144 268 210 224 C276 178 324 204 386 150 C452 92 510 124 578 70 C632 28 682 36 736 18"
    : "M24 26 C100 56 142 44 204 90 C270 140 322 114 388 178 C452 236 512 210 580 270 C636 318 686 310 736 338";
  const blastYs = isBull ? ["72%", "16%"] : ["18%", "78%"];
  const candleAnchor = isBull ? "bottom-[17%]" : "top-[16%]";
  const bodyOrigin = isBull ? "bottom" : "top";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="absolute inset-0 z-20 overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.44, 0] }}
        transition={{ duration: 0.72, ease: "easeOut" }}
        className="absolute inset-0 mix-blend-screen"
        style={{ background: `radial-gradient(circle at 64% ${isBull ? "32%" : "64%"}, ${color}88, transparent 54%)` }}
      />
      <div className="absolute left-1/2 top-1/2 h-[min(62vh,560px)] w-[min(900px,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 rounded-[28px] border border-white/10 bg-black/34 shadow-[0_26px_80px_rgba(0,0,0,0.42)] backdrop-blur-[2px]" />
        <svg className="absolute inset-[5%] h-[90%] w-[90%] overflow-visible" viewBox="0 0 760 360" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`chart-candle-${event.id}`} x1="0" x2="1" y1={isBull ? "1" : "0"} y2={isBull ? "0" : "1"}>
              <stop offset="0%" stopColor={isBull ? "#0c7d62" : "#7b1025"} stopOpacity="0.12" />
              <stop offset="100%" stopColor={color} stopOpacity="0.42" />
            </linearGradient>
          </defs>
          {[72, 144, 216, 288].map((y) => (
            <path key={y} d={`M0 ${y} H760`} stroke="rgba(255,255,255,0.1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {[110, 250, 390, 530, 670].map((x) => (
            <path key={x} d={`M${x} 0 V360`} stroke="rgba(255,255,255,0.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <motion.path
            d={path}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="8"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0, filter: "blur(6px)" }}
            animate={{ pathLength: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.88, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 18px ${glow})` }}
          />
          <motion.path
            d={`${path} L736 ${isBull ? 360 : 0} L24 ${isBull ? 360 : 0} Z`}
            fill={`url(#chart-candle-${event.id})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.56, 0.18] }}
            transition={{ duration: 1.4, delay: 0.18, ease: "easeOut" }}
          />
        </svg>
        <motion.div
          initial={{ opacity: 0, scaleX: 0.55 }}
          animate={{ opacity: [0, 1, 1, 0], scaleX: [0.55, 1.08, 1, 0.96] }}
          transition={{ duration: 2.55, times: [0, 0.18, 0.78, 1], ease: "easeOut" }}
          className={`absolute left-[62%] h-[70%] w-[86px] ${candleAnchor}`}
          style={{ transformOrigin: "center center", willChange: "transform, opacity" }}
        >
          <motion.div
            initial={{ scaleY: 0.04 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.74, delay: 0.28, ease: [0.12, 0.85, 0.18, 1] }}
            className={`absolute left-1/2 h-[116%] w-[7px] -translate-x-1/2 rounded-full ${isBull ? "bottom-[-8%]" : "top-[-8%]"}`}
            style={{ background: color, boxShadow: `0 0 26px ${glow}`, transformOrigin: bodyOrigin }}
          />
          <motion.div
            initial={{ scaleY: 0.06 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.86, delay: 0.34, ease: [0.12, 0.85, 0.18, 1] }}
            className={`absolute left-0 h-[72%] w-full rounded-[10px] border border-white/28 ${isBull ? "bottom-[12%]" : "top-[12%]"}`}
            style={{
              background: `linear-gradient(90deg, ${isBull ? "#07966f" : "#9b1230"}, ${color}, ${isBull ? "#c7ffef" : "#ffb3c0"})`,
              boxShadow: `0 0 42px ${glow}, inset 0 0 18px rgba(255,255,255,0.24)`,
              transformOrigin: bodyOrigin,
            }}
          />
          <motion.div
            initial={{ y: blastYs[0], opacity: 0 }}
            animate={{ y: blastYs, opacity: [0, 1, 0] }}
            transition={{ duration: 0.74, delay: 0.58, ease: "easeOut" }}
            className="absolute left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border border-white/35"
            style={{ boxShadow: `0 0 42px ${glow}` }}
          />
        </motion.div>
        {Array.from({ length: 24 }, (_, i) => {
          const seed = hash(`${event.id}-candle-${i}`);
          const left = 10 + (seed % 78);
          const delay = 0.24 + (seed % 10) * 0.035;
          const distance = 32 + (seed % 46);
          return (
            <motion.span
              key={`${event.id}-spark-${i}`}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.55 }}
              animate={{ opacity: [0, 1, 0], x: ((seed % 28) - 14), y: isBull ? -distance : distance, scale: [0.55, 1, 0.2] }}
              transition={{ duration: 1.1 + (seed % 5) * 0.08, delay, ease: "easeOut" }}
              className="absolute h-[3px] w-10 rounded-sm"
              style={{ left: `${left}%`, top: isBull ? `${60 - (seed % 22)}%` : `${26 + (seed % 22)}%`, background: color, boxShadow: `0 0 18px ${glow}`, rotate: isBull ? "-24deg" : "24deg", willChange: "transform, opacity" }}
            />
          );
        })}
      </div>
      <HeroLabel event={event} title={`${ticker} ${isBull ? "green candle" : "red candle"}`} color={color} />
    </motion.div>
  );
}

function ShockStreaks({ color, side }: { color: string; side: "bull" | "bear" }) {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: 16 }, (_, i) => (
        <motion.span
          key={`${side}-shock-${i}`}
          initial={{ opacity: 0, scaleX: 0.25, x: side === "bull" ? "-18vw" : "18vw" }}
          animate={{ opacity: [0, 0.68, 0], scaleX: [0.25, 1.15, 0.55], x: side === "bull" ? "98vw" : "-98vw" }}
          transition={{ duration: 0.82 + (i % 4) * 0.06, delay: i * 0.028, ease: "easeOut" }}
          className="absolute h-[3px] origin-center rounded-sm"
          style={{
            top: `${16 + ((i * 9) % 68)}%`,
            left: side === "bull" ? "-14%" : "76%",
            width: `${16 + (i % 5) * 7}%`,
            rotate: side === "bull" ? "-8deg" : "8deg",
            background: `linear-gradient(90deg, transparent, ${color}, white, transparent)`,
            boxShadow: `0 0 16px ${color}`,
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
  const emote = event.payload?.emote ?? "🚀";
  const asset = brandedEmoteAsset(event.actionId);
  const count = event.actionId === "whale-storm" ? 34 : asset ? 22 : 18;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const seed = hash(`${event.id}-${i}`);
        const left = 8 + (seed % 84);
        const delay = (seed % 9) * 0.035;
        const size = asset ? 42 + (seed % 22) : 19 + (seed % 19);
        return (
          <motion.span
            key={`${event.id}-${i}`}
            initial={{ y: "105vh", x: 0, opacity: 0, rotate: -18 }}
            animate={{ y: "-16vh", x: ((seed % 40) - 20), opacity: [0, 1, 1, 0], rotate: 22 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3.2 + (seed % 7) * 0.18, delay, ease: "easeOut" }}
            className="absolute font-black"
            style={{ left: `${left}%`, fontSize: size, filter: asset ? `drop-shadow(0 8px 16px rgba(0,0,0,0.58)) drop-shadow(0 0 12px ${asset.glow})` : "drop-shadow(0 3px 10px rgba(0,0,0,0.65))" }}
          >
            {asset ? <ImageEmote asset={asset} seed={seed} size={size} /> : emote}
          </motion.span>
        );
      })}
    </>
  );
}

type EmoteAsset = { src: string; alt: string; glow: string; aspect?: string };

function brandedEmoteAsset(actionId: string): EmoteAsset | null {
  switch (actionId) {
    case "ansem-emote":
      return { src: "/overlay-emotes/ansem.png", alt: "Ansem", glow: "rgba(245,158,11,0.64)" };
    case "banks-emote":
      return { src: "/overlay-emotes/banks.png", alt: "Banks", glow: "rgba(56,189,248,0.64)" };
    case "nelk-emote":
      return { src: "/overlay-emotes/nelk.png", alt: "NELK", glow: "rgba(248,250,252,0.58)", aspect: "auto" };
    case "happy-dad-emote":
      return { src: "/overlay-emotes/happy-dad.svg", alt: "Happy Dad", glow: "rgba(250,204,21,0.58)", aspect: "wide" };
    case "polymarket-emote":
      return { src: "/overlay-emotes/polymarket.svg", alt: "Polymarket", glow: "rgba(52,214,255,0.62)" };
    default:
      return null;
  }
}

function ImageEmote({ asset, seed, size }: { asset: EmoteAsset; seed: number; size: number }) {
  const tilt = (seed % 18) - 9;
  const width = asset.aspect === "wide" ? size * 1.72 : asset.aspect === "auto" ? size * 1.18 : size;
  return (
    <img
      src={asset.src}
      alt={asset.alt}
      draggable={false}
      className="block select-none object-contain"
      style={{ width, height: size, transform: `rotate(${tilt}deg)` }}
    />
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
    } else if (event.actionId === "bear-slash") {
      playBearSlashSfx(ctx, start);
    } else if (event.actionId === "chart-pump") {
      playChartCandleSfx(ctx, start, "bull");
    } else if (event.actionId === "chart-dump") {
      playChartCandleSfx(ctx, start, "bear");
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

function playChartCandleSfx(ctx: AudioContext, start: number, side: "bull" | "bear"): void {
  const isBull = side === "bull";
  const master = createEffectMaster(ctx, start, 2.25, 0.21);

  const sweep = ctx.createOscillator();
  const sweepGain = ctx.createGain();
  sweep.type = "sawtooth";
  sweep.frequency.setValueAtTime(isBull ? 96 : 260, start);
  sweep.frequency.exponentialRampToValueAtTime(isBull ? 720 : 48, start + 0.95);
  sweepGain.gain.setValueAtTime(0.0001, start);
  sweepGain.gain.exponentialRampToValueAtTime(0.13, start + 0.08);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, start + 1.28);
  sweep.connect(sweepGain);
  connectSpatial(ctx, sweepGain, master, isBull ? -0.35 : 0.35, isBull ? 0.35 : -0.35, start, 1.1);
  sweep.start(start);
  sweep.stop(start + 1.35);

  const burst = createNoiseSource(ctx, 0.95);
  const burstFilter = ctx.createBiquadFilter();
  const burstGain = ctx.createGain();
  burstFilter.type = isBull ? "bandpass" : "lowpass";
  burstFilter.frequency.setValueAtTime(isBull ? 620 : 320, start);
  burstFilter.frequency.exponentialRampToValueAtTime(isBull ? 2600 : 90, start + 0.72);
  burstFilter.Q.setValueAtTime(isBull ? 0.82 : 1.15, start);
  burstGain.gain.setValueAtTime(0.0001, start + 0.18);
  burstGain.gain.exponentialRampToValueAtTime(0.15, start + 0.38);
  burstGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.92);
  burst.connect(burstFilter);
  burstFilter.connect(burstGain);
  connectSpatial(ctx, burstGain, master, 0, 0, start, 0.95);
  burst.start(start);
  burst.stop(start + 0.96);

  if (isBull) {
    for (let i = 0; i < 4; i++) schedulePing(ctx, master, start + 0.42 + i * 0.12, 360 + i * 150, -0.25 + i * 0.16);
  } else {
    scheduleThump(ctx, master, start + 0.48, 0.1, 66);
    scheduleThump(ctx, master, start + 0.76, -0.1, 44);
  }
}

function schedulePing(ctx: AudioContext, output: AudioNode, when: number, frequency: number, panValue: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, when);
  osc.frequency.exponentialRampToValueAtTime(frequency * 1.32, when + 0.11);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.11, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
  osc.connect(gain);
  connectSpatial(ctx, gain, output, panValue, panValue + 0.06, when, 0.13);
  osc.start(when);
  osc.stop(when + 0.15);
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
