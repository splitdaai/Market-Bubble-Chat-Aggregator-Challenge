import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { engageUrl, qrImageUrl, subscribeOverlayEvents, type OverlayEngagementEvent } from "@/lib/overlayEngagement";
import { profileAlpha, profileCount, profileDuration } from "@/lib/overlayFx";
import { useOverlayStore } from "@/store/overlayStore";
import type { OverlayEffectProfile } from "@shared/types";

const TTL = 9000;
const METER_IDLE_MS = 5000;
const EVENT_FLUSH_MS = 80;
const MAX_EVENT_HISTORY = 16;
const MAX_PENDING_EVENTS = 72;
const MAX_FLUSH_EVENTS = 36;
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
const FX_EASE = [0.16, 1, 0.3, 1] as const;
const IMPACT_EASE = [0.12, 0.8, 0.18, 1] as const;
const GLASS_EDGE = "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04) 34%, rgba(255,255,255,0.14))";

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
  const effectProfiles = useOverlayStore((s) => s.effectProfiles);
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

  const flushPendingEvents = useCallback(function flushPendingEvents() {
    flushTimer.current = null;
    const batch = pendingEvents.current.splice(0, Math.min(pendingEvents.current.length, MAX_FLUSH_EVENTS));
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
      if (hero) playOverlayHeroSfx(hero, effectProfiles[hero.actionId]);
      setEvents((prev) => [...visualEvents.reverse(), ...prev].slice(0, MAX_EVENT_HISTORY));
    }
    if (pendingEvents.current.length && flushTimer.current === null) {
      flushTimer.current = window.setTimeout(flushPendingEvents, EVENT_FLUSH_MS);
    }
  }, [effectProfiles]);

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
      if (pendingEvents.current.length > MAX_PENDING_EVENTS) {
        pendingEvents.current.splice(0, pendingEvents.current.length - MAX_PENDING_EVENTS);
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
        {latestWave && profileEnabled(effectProfiles[latestWave.actionId]) && <ColorWave key={latestWave.id} event={latestWave} profile={effectProfiles[latestWave.actionId]} />}
        {heroEvents.filter((event) => profileEnabled(effectProfiles[event.actionId])).map((event) => <HeroEffect key={event.id} event={event} profile={effectProfiles[event.actionId]} />)}
        {visible.filter((e) => e.kind === "emote" && profileEnabled(effectProfiles[e.actionId])).slice(0, 4).map((event) => <EmoteBurst key={event.id} event={event} profile={effectProfiles[event.actionId]} />)}
        {latestSpotlight && profileEnabled(effectProfiles[latestSpotlight.actionId]) && <Spotlight key={latestSpotlight.id} event={latestSpotlight} profile={effectProfiles[latestSpotlight.actionId]} />}
        {latestClip && profileEnabled(effectProfiles[latestClip.actionId]) && <ClipBoost key={latestClip.id} event={latestClip} profile={effectProfiles[latestClip.actionId]} />}
        {latestSound && profileEnabled(effectProfiles[latestSound.actionId]) && <Soundwave key={latestSound.id} event={latestSound} profile={effectProfiles[latestSound.actionId]} />}
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
      {tickerEvents.length > 0 && <TickerTape events={tickerEvents.filter((event) => profileEnabled(effectProfiles[event.actionId]))} profile={effectProfiles["ticker-boost"]} />}
    </div>
  );
}

function BullBearMeter({ bullPct, lastSide, pulseKey }: { bullPct: number; lastSide: "bull" | "bear"; pulseKey: number }) {
  const bearPct = 100 - bullPct;
  const accent = lastSide === "bull" ? "#16e6a4" : "#ff5c7a";
  const bearStrength = 100 - bullPct;
  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.95, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -10, scale: 0.98, filter: "blur(4px)" }}
      transition={{ duration: 0.34, ease: FX_EASE }}
      className="absolute left-1/2 top-[52px] -translate-x-1/2 overflow-hidden rounded-2xl px-3.5 py-3 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
      style={{
        width: "min(520px, calc(100vw - 28px))",
        background: "linear-gradient(135deg, rgba(7,9,10,0.92), rgba(10,14,15,0.74))",
        boxShadow: `0 22px 70px rgba(0,0,0,0.58), 0 0 34px ${accent}24, inset 0 1px 0 rgba(255,255,255,0.14)`,
      }}
    >
      <motion.div
        key={pulseKey}
        className="absolute inset-0"
        initial={{ opacity: 0.44 }}
        animate={{ opacity: [0.44, 0.2, 0] }}
        transition={{ duration: 1.05, ease: "easeOut" }}
        style={{
          background: `radial-gradient(circle at ${lastSide === "bull" ? "22%" : "78%"} 50%, ${accent}88, transparent 48%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-px rounded-2xl" style={{ background: GLASS_EDGE, maskImage: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", padding: 1 }} />
      <div className="relative flex items-center gap-3">
        <motion.div
          key={`bull-score-${bullPct}`}
          initial={{ scale: lastSide === "bull" ? 0.92 : 1 }}
          animate={{ scale: lastSide === "bull" ? [0.92, 1.12, 1] : 1 }}
          transition={{ duration: 0.44, ease: FX_EASE }}
          className="w-[88px] text-left"
        >
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#16e6a4]">Bull Flow</div>
          <div className="mt-0.5 text-[24px] font-black leading-none tabular-nums text-white drop-shadow-[0_0_14px_rgba(22,230,164,0.45)]">{bullPct}%</div>
        </motion.div>
        <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-[#ff5c7a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16),inset_0_2px_12px_rgba(0,0,0,0.62)]">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
              backgroundSize: "10% 100%",
            }}
          />
          <motion.div
            className="absolute inset-y-0 left-0 overflow-hidden rounded-l-lg"
            animate={{ width: `${bullPct}%` }}
            transition={{ type: "spring", stiffness: 230, damping: 26 }}
            style={{
              background: "linear-gradient(90deg, #047857, #16e6a4 66%, #baffea)",
              boxShadow: "0 0 26px rgba(22,230,164,0.54), inset 0 0 18px rgba(255,255,255,0.16)",
            }}
          >
            <motion.div
              className="absolute inset-y-0 w-20 skew-x-[-18deg] bg-white/40"
              initial={{ x: "-110%" }}
              animate={{ x: "320%" }}
              transition={{ duration: 1.25, repeat: Infinity, repeatDelay: 1.1, ease: "easeInOut" }}
            />
          </motion.div>
          <motion.div
            className="absolute inset-y-0 right-0"
            animate={{ width: `${bearStrength}%` }}
            transition={{ type: "spring", stiffness: 230, damping: 26 }}
            style={{
              background: "linear-gradient(270deg, #8f1230, #ff5c7a 70%, #ffc0ca)",
              boxShadow: "inset 0 0 18px rgba(255,255,255,0.12)",
            }}
          />
          <motion.div
            className="absolute top-[-6px] h-[calc(100%+12px)] w-[4px] rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.92)]"
            animate={{ left: `calc(${bullPct}% - 2px)` }}
            transition={{ type: "spring", stiffness: 230, damping: 26 }}
          />
          <motion.div
            key={`meter-scan-${pulseKey}`}
            initial={{ x: "-140%", opacity: 0 }}
            animate={{ x: "240%", opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-y-0 w-24 skew-x-[-18deg] bg-white/55"
          />
          {Array.from({ length: 7 }, (_, i) => (
            <motion.span
              key={`meter-spark-${pulseKey}-${i}`}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], y: lastSide === "bull" ? -18 - i * 2 : 18 + i * 2, scale: [0.5, 1, 0.2] }}
              transition={{ duration: 0.7, delay: i * 0.035, ease: "easeOut" }}
              className="absolute h-1 w-7 rounded-full"
              style={{
                left: `calc(${bullPct}% + ${(i - 3) * 9}px)`,
                top: `${28 + (i % 3) * 14}%`,
                background: accent,
                boxShadow: `0 0 16px ${accent}`,
              }}
            />
          ))}
        </div>
        <motion.div
          key={`bear-score-${bearPct}`}
          initial={{ scale: lastSide === "bear" ? 0.92 : 1 }}
          animate={{ scale: lastSide === "bear" ? [0.92, 1.12, 1] : 1 }}
          transition={{ duration: 0.44, ease: FX_EASE }}
          className="w-[88px] text-right"
        >
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ff5c7a]">Bear Flow</div>
          <div className="mt-0.5 text-[24px] font-black leading-none tabular-nums text-white drop-shadow-[0_0_14px_rgba(255,92,122,0.45)]">{bearPct}%</div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function HeroEffect({ event, profile }: { event: OverlayEngagementEvent; profile?: OverlayEffectProfile }) {
  switch (event.actionId) {
    case "charging-bull":
      return <ChargingBull event={event} profile={profile} />;
    case "bear-slash":
      return <BearSlash event={event} profile={profile} />;
    case "chart-pump":
      return <ChartCandleBurst event={event} side="bull" profile={profile} />;
    case "chart-dump":
      return <ChartCandleBurst event={event} side="bear" profile={profile} />;
    default:
      return null;
  }
}

function profileEnabled(profile?: OverlayEffectProfile): boolean {
  return profile?.enabled ?? true;
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;
  const value = /^[0-9a-fA-F]{6}$/.test(full) ? full : "16e6a4";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

function CinematicVignette({ color, focus = "50% 50%" }: { color: string; focus?: string }) {
  return (
    <>
      <motion.div
        className="absolute inset-0 mix-blend-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.44, 0.18, 0] }}
        transition={{ duration: 2.7, times: [0, 0.18, 0.66, 1], ease: "easeOut" }}
        style={{ background: `radial-gradient(circle at ${focus}, ${color}66, transparent 44%)` }}
      />
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.58, 0.28, 0] }}
        transition={{ duration: 2.8, times: [0, 0.12, 0.68, 1], ease: "easeOut" }}
        style={{
          background: "radial-gradient(circle at 50% 50%, transparent 38%, rgba(0,0,0,0.42) 100%)",
        }}
      />
    </>
  );
}

function LensStreak({ color, delay = 0, reverse = false }: { color: string; delay?: number; reverse?: boolean }) {
  return (
    <motion.span
      initial={{ opacity: 0, x: reverse ? "110vw" : "-40vw", scaleX: 0.2 }}
      animate={{ opacity: [0, 0.72, 0], x: reverse ? "-68vw" : "138vw", scaleX: [0.2, 1.35, 0.5] }}
      transition={{ duration: 1.05, delay, ease: IMPACT_EASE }}
      className="absolute left-0 top-1/2 h-[2px] w-[48vw] -translate-y-1/2 rounded-full"
      style={{
        background: `linear-gradient(90deg, transparent, #fff, ${color}, transparent)`,
        boxShadow: `0 0 22px ${color}`,
        rotate: reverse ? "9deg" : "-9deg",
        willChange: "transform, opacity",
      }}
    />
  );
}

function ImpactRing({ color, x, y, delay = 0 }: { color: string; x: string; y: string; delay?: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.16, filter: "blur(0px)" }}
      animate={{ opacity: [0, 0.9, 0], scale: [0.16, 1.45, 2.4], filter: ["blur(0px)", "blur(0px)", "blur(6px)"] }}
      transition={{ duration: 1.05, delay, ease: "easeOut" }}
      className="absolute h-[24vw] max-h-[360px] min-h-[160px] w-[24vw] min-w-[160px] max-w-[360px] rounded-full border"
      style={{
        left: x,
        top: y,
        borderColor: color,
        boxShadow: `0 0 28px ${color}, inset 0 0 28px ${color}`,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

function DebrisField({ eventId, color, side, count = 26 }: { eventId: string; color: string; side: "bull" | "bear"; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const seed = hash(`${eventId}-debris-${i}`);
        const startX = side === "bull" ? 16 + (seed % 24) : 82 - (seed % 24);
        const travel = side === "bull" ? 120 + (seed % 150) : -120 - (seed % 150);
        const lift = -80 + (seed % 160);
        return (
          <motion.span
            key={`${eventId}-debris-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.32, rotate: 0 }}
            animate={{ opacity: [0, 1, 0], x: travel, y: lift, scale: [0.32, 1, 0.2], rotate: side === "bull" ? 190 : -190 }}
            transition={{ duration: 1.1 + (seed % 8) * 0.07, delay: 0.18 + (seed % 12) * 0.018, ease: "easeOut" }}
            className="absolute rounded-[2px]"
            style={{
              left: `${startX}%`,
              top: `${28 + (seed % 50)}%`,
              width: 7 + (seed % 14),
              height: 2 + (seed % 5),
              background: `linear-gradient(90deg, #fff, ${color})`,
              boxShadow: `0 0 12px ${color}`,
              willChange: "transform, opacity",
            }}
          />
        );
      })}
    </>
  );
}

function ChargingBull({ event, profile }: { event: OverlayEngagementEvent; profile?: OverlayEffectProfile }) {
  const color = profile?.accent ?? "#16e6a4";
  const scale = profile?.scale ?? 1;
  const blur = profile?.blur ?? 1;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: [0, -12, 9, -5, 0], y: [0, 2, -2, 1, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: profileDuration(profile, 0.56), ease: "easeOut" }}
      className="absolute inset-0 z-20 overflow-hidden"
    >
      <CinematicVignette color={color} focus="28% 58%" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.52, 0.12, 0] }}
        transition={{ duration: profileDuration(profile, 0.76), ease: "easeOut" }}
        className="absolute inset-0 mix-blend-screen"
        style={{ background: `linear-gradient(100deg, transparent 0%, ${hexToRgba(color, profileAlpha(profile, 0.52))} 42%, rgba(255,255,255,0.45) 50%, transparent 74%)` }}
      />
      <ImpactRing color={color} x="48%" y="58%" delay={profileDuration(profile, 0.54)} />
      <ImpactRing color="#d7fff2" x="58%" y="52%" delay={profileDuration(profile, 0.72)} />
      <DebrisField eventId={event.id} color={color} side="bull" count={profileCount(profile, 26)} />
      <LensStreak color={color} delay={profileDuration(profile, 0.18)} />
      <LensStreak color="#d7fff2" delay={profileDuration(profile, 0.58)} />
      {Array.from({ length: profileCount(profile, 16) }, (_, i) => (
        <motion.span
          key={`${event.id}-speed-${i}`}
          initial={{ x: "-30vw", opacity: 0, scaleX: 0.25 }}
          animate={{ x: "124vw", opacity: [0, 0.9, 0], scaleX: [0.25, 1.45, 0.4] }}
          transition={{ duration: profileDuration(profile, 1.18 + (i % 5) * 0.1), delay: profileDuration(profile, i * 0.035), ease: IMPACT_EASE }}
          className="absolute h-[3px] rounded-full blur-[0.5px]"
          style={{ top: `${18 + ((i * 11) % 64)}%`, left: "-18%", width: `${18 + (i % 4) * 8}%`, background: `linear-gradient(90deg,transparent,#d7fff2,${color},transparent)` }}
        />
      ))}
      <ShockStreaks color={color} side="bull" count={profileCount(profile, 16)} durationScale={profile?.durationScale ?? 1} />
      <motion.div
        initial={{ opacity: 0, scaleX: 0.4 }}
        animate={{ opacity: [0, profileAlpha(profile, 0.85), 0], scaleX: [0.4, 1.25, 0.8] }}
        transition={{ duration: profileDuration(profile, 1.25), delay: profileDuration(profile, 0.48), ease: "easeOut" }}
        className="absolute bottom-[14%] left-[-10%] h-[16vh] w-[120%] origin-left blur-xl"
        style={{ background: `linear-gradient(90deg, transparent, ${hexToRgba(color, profileAlpha(profile, 0.28))}, rgba(255,255,255,0.22), transparent)` }}
      />
      <motion.img
        src={BULL_ASSET}
        alt=""
        draggable={false}
        initial={{ x: "-78vw", y: "28vh", opacity: 0, scale: 0.72 * scale, rotate: -3, filter: `blur(${5 * blur}px) contrast(1.15) saturate(1.2) drop-shadow(0 0 0 ${hexToRgba(color, 0)})` }}
        animate={{
          x: ["-78vw", "-18vw", "14vw", "42vw", "118vw"],
          y: ["30vh", "22vh", "17vh", "18vh", "24vh"],
          opacity: [0, 1, 1, 1, 0],
          scale: [0.72 * scale, 1.04 * scale, 1.18 * scale, 1.16 * scale, 1.04 * scale],
          rotate: [-3, 1.5, -1, 0.6, 0],
          filter: [
            `blur(${5 * blur}px) contrast(1.18) saturate(1.22) drop-shadow(0 0 0 ${hexToRgba(color, 0)})`,
            `blur(0px) contrast(1.12) saturate(1.18) drop-shadow(0 0 34px ${hexToRgba(color, profileAlpha(profile, 0.52))})`,
            `blur(0px) contrast(1.12) saturate(1.2) drop-shadow(0 0 42px ${hexToRgba(color, profileAlpha(profile, 0.62))})`,
            `blur(0px) contrast(1.12) saturate(1.18) drop-shadow(0 0 36px ${hexToRgba(color, profileAlpha(profile, 0.52))})`,
            `blur(${2 * blur}px) contrast(1.08) saturate(1.12) drop-shadow(0 0 18px ${hexToRgba(color, profileAlpha(profile, 0.32))})`,
          ],
        }}
        transition={{ duration: profileDuration(profile, 4.35), times: [0, 0.25, 0.5, 0.74, 1], ease: IMPACT_EASE }}
        className="absolute left-0 h-[min(44vh,430px)] max-h-[430px] min-h-[210px] w-auto select-none drop-shadow-[0_24px_38px_rgba(0,0,0,0.62)]"
        style={{ willChange: "transform, opacity, filter" }}
      />
      <HeroLabel event={event} title="Bull charge" color={color} profile={profile} />
    </motion.div>
  );
}

function BearSlash({ event, profile }: { event: OverlayEngagementEvent; profile?: OverlayEffectProfile }) {
  const color = profile?.accent ?? "#ff5c7a";
  const scale = profile?.scale ?? 1;
  const blur = profile?.blur ?? 1;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: [0, 10, -12, 5, 0], y: [0, -2, 2, -1, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: profileDuration(profile, 0.56), ease: "easeOut" }}
      className="absolute inset-0 z-20 overflow-hidden"
    >
      <CinematicVignette color={color} focus="72% 52%" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.58, 0.1, 0] }}
        transition={{ duration: profileDuration(profile, 0.58), ease: "easeOut" }}
        className="absolute inset-0 mix-blend-screen"
        style={{ background: `linear-gradient(80deg, transparent 8%, rgba(255,255,255,0.4) 42%, ${hexToRgba(color, profileAlpha(profile, 0.58))} 54%, transparent 78%)` }}
      />
      <ImpactRing color={color} x="54%" y="46%" delay={profileDuration(profile, 0.44)} />
      <ImpactRing color="#ffc0ca" x="44%" y="55%" delay={profileDuration(profile, 0.6)} />
      <DebrisField eventId={event.id} color={color} side="bear" count={profileCount(profile, 26)} />
      <LensStreak color={color} delay={profileDuration(profile, 0.12)} reverse />
      <LensStreak color="#ffc0ca" delay={profileDuration(profile, 0.5)} reverse />
      <ShockStreaks color={color} side="bear" count={profileCount(profile, 16)} durationScale={profile?.durationScale ?? 1} />
      {Array.from({ length: profileCount(profile, 3) }, (_, i) => (
        <motion.span
          key={`${event.id}-claw-${i}`}
          initial={{ scaleX: 0, opacity: 0, x: "34vw", filter: "blur(5px)" }}
          animate={{ scaleX: [0, 1.08, 0.96], opacity: [0, profileAlpha(profile, 1), 0], x: "-26vw", filter: [`blur(${5 * blur}px)`, "blur(0px)", `blur(${2 * blur}px)`] }}
          transition={{ duration: profileDuration(profile, 1.05), delay: profileDuration(profile, 0.52 + i * 0.08), ease: IMPACT_EASE }}
          className="absolute left-[10%] h-[11px] w-[84%] origin-right rotate-[-17deg] rounded-full"
          style={{ top: `${34 + i * 6}%`, background: `linear-gradient(90deg,transparent,#fff,${color},#7d1025,transparent)`, boxShadow: `0 0 34px ${hexToRgba(color, profileAlpha(profile, 0.84))}` }}
        />
      ))}
      <motion.img
        src={BEAR_ASSET}
        alt=""
        draggable={false}
        initial={{ x: "82vw", y: "18vh", opacity: 0, scale: 0.76 * scale, rotate: 4, filter: `blur(${6 * blur}px) contrast(1.16) saturate(1.2) drop-shadow(0 0 0 ${hexToRgba(color, 0)})` }}
        animate={{
          x: ["82vw", "24vw", "0vw", "-28vw", "-116vw"],
          y: ["21vh", "15vh", "16vh", "18vh", "25vh"],
          opacity: [0, 1, 1, 1, 0],
          scale: [0.76 * scale, 1.08 * scale, 1.18 * scale, 1.14 * scale, 1.02 * scale],
          rotate: [4, -2, 1, -1, -5],
          filter: [
            `blur(${6 * blur}px) contrast(1.18) saturate(1.2) drop-shadow(0 0 0 ${hexToRgba(color, 0)})`,
            `blur(0px) contrast(1.12) saturate(1.18) drop-shadow(0 0 34px ${hexToRgba(color, profileAlpha(profile, 0.56))})`,
            `blur(0px) contrast(1.12) saturate(1.2) drop-shadow(0 0 42px ${hexToRgba(color, profileAlpha(profile, 0.66))})`,
            `blur(0px) contrast(1.12) saturate(1.18) drop-shadow(0 0 36px ${hexToRgba(color, profileAlpha(profile, 0.54))})`,
            `blur(${2 * blur}px) contrast(1.08) saturate(1.12) drop-shadow(0 0 18px ${hexToRgba(color, profileAlpha(profile, 0.34))})`,
          ],
        }}
        transition={{ duration: profileDuration(profile, 4.15), times: [0, 0.24, 0.5, 0.73, 1], ease: IMPACT_EASE }}
        className="absolute right-0 h-[min(48vh,460px)] max-h-[460px] min-h-[220px] w-auto select-none drop-shadow-[0_24px_38px_rgba(0,0,0,0.66)]"
        style={{ willChange: "transform, opacity, filter" }}
      />
      <HeroLabel event={event} title="Bear slash" color={color} profile={profile} />
    </motion.div>
  );
}

function ChartCandleBurst({ event, side, profile }: { event: OverlayEngagementEvent; side: "bull" | "bear"; profile?: OverlayEffectProfile }) {
  const ticker = eventTicker(event);
  const isBull = side === "bull";
  const color = profile?.accent ?? (isBull ? "#16e6a4" : "#ff3f5f");
  const glow = hexToRgba(color, profileAlpha(profile, 0.58));
  const scale = profile?.scale ?? 1;
  const blur = profile?.blur ?? 1;
  const path = isBull
    ? "M24 280 C104 254 144 268 210 224 C276 178 324 204 386 150 C452 92 510 124 578 70 C632 28 682 36 736 18"
    : "M24 26 C100 56 142 44 204 90 C270 140 322 114 388 178 C452 236 512 210 580 270 C636 318 686 310 736 338";
  const blastYs = isBull ? ["72%", "16%"] : ["18%", "78%"];
  const candleAnchor = isBull ? "bottom-[17%]" : "top-[16%]";
  const bodyOrigin = isBull ? "bottom" : "top";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: profileDuration(profile, 3.15), times: [0, 0.08, 0.76, 1], ease: "easeOut" }}
      className="absolute inset-0 z-20 overflow-hidden"
    >
      <CinematicVignette color={color} focus={`64% ${isBull ? "36%" : "64%"}`} />
      <LensStreak color={color} delay={profileDuration(profile, 0.28)} reverse={!isBull} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, profileAlpha(profile, 0.44), 0] }}
        transition={{ duration: profileDuration(profile, 0.72), ease: "easeOut" }}
        className="absolute inset-0 mix-blend-screen"
        style={{ background: `radial-gradient(circle at 64% ${isBull ? "32%" : "64%"}, ${color}88, transparent 54%)` }}
      />
      <div className="absolute left-1/2 top-1/2 h-[min(62vh,560px)] w-[min(900px,92vw)] -translate-x-1/2 -translate-y-1/2">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, rotateX: isBull ? 5 : -5 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.94 * scale, 1 * scale, 1.02 * scale, 0.98 * scale], rotateX: 0 }}
          transition={{ duration: profileDuration(profile, 3), times: [0, 0.14, 0.78, 1], ease: FX_EASE }}
          className="absolute inset-0 overflow-hidden rounded-[28px] bg-black/44 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-[2px]"
          style={{ border: "1px solid rgba(255,255,255,0.14)", boxShadow: `0 30px 90px rgba(0,0,0,0.5), 0 0 48px ${glow}` }}
        >
          <div className="absolute inset-px rounded-[27px]" style={{ background: GLASS_EDGE, opacity: 0.38 }} />
          <motion.div
            className="absolute inset-y-0 w-28 skew-x-[-18deg] bg-white/18"
            initial={{ x: "-120%" }}
            animate={{ x: "900%" }}
            transition={{ duration: profileDuration(profile, 1.45), delay: profileDuration(profile, 0.25), ease: "easeOut" }}
          />
        </motion.div>
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
            initial={{ pathLength: 0, opacity: 0, filter: `blur(${6 * blur}px)` }}
            animate={{ pathLength: 1, opacity: [0, 1, 1, 0], filter: "blur(0px)" }}
            transition={{ duration: profileDuration(profile, 2.8), times: [0, 0.22, 0.76, 1], ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 18px ${glow})` }}
          />
          <motion.path
            d={`${path} L736 ${isBull ? 360 : 0} L24 ${isBull ? 360 : 0} Z`}
            fill={`url(#chart-candle-${event.id})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.56, 0.18] }}
            transition={{ duration: profileDuration(profile, 1.4), delay: profileDuration(profile, 0.18), ease: "easeOut" }}
          />
        </svg>
        <div className="absolute bottom-[8%] left-[7%] right-[7%] flex h-[18%] items-end gap-[1.2%] opacity-80">
          {Array.from({ length: profileCount(profile, 26) }, (_, i) => {
            const seed = hash(`${event.id}-volume-${i}`);
            const height = 18 + (seed % 72);
            return (
              <motion.span
                key={`${event.id}-volume-${i}`}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1, isBull ? 0.72 : 0.58], opacity: [0, 0.82, 0.2] }}
                transition={{ duration: profileDuration(profile, 1.1), delay: profileDuration(profile, 0.18 + i * 0.018), ease: "easeOut" }}
                className="min-w-[4px] flex-1 origin-bottom rounded-t-sm"
                style={{
                  height: `${height}%`,
                  background: i % 5 === 0 ? "#fff" : color,
                  boxShadow: `0 0 14px ${glow}`,
                }}
              />
            );
          })}
        </div>
        <motion.div
          initial={{ opacity: 0, x: isBull ? 28 : -28, y: isBull ? -18 : 18, scale: 0.9 }}
          animate={{ opacity: [0, 1, 1, 0], x: 0, y: 0, scale: [0.9, 1, 1] }}
          transition={{ duration: profileDuration(profile, 2.2), delay: profileDuration(profile, 0.58), times: [0, 0.2, 0.8, 1], ease: FX_EASE }}
          className={`absolute ${isBull ? "right-[10%] top-[13%]" : "left-[10%] bottom-[13%]"} rounded-xl px-3 py-2 text-right shadow-[0_16px_34px_rgba(0,0,0,0.42)] backdrop-blur`}
          style={{ background: "rgba(0,0,0,0.58)", border: `1px solid ${color}66`, boxShadow: `0 16px 34px rgba(0,0,0,0.42), 0 0 24px ${glow}` }}
        >
          <div className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color }}>{ticker}</div>
          <div className="text-lg font-black leading-none text-white">{isBull ? "+8.42%" : "-6.19%"}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scaleX: 0.55 }}
          animate={{ opacity: [0, 1, 1, 0], scaleX: [0.55, 1.08, 1, 0.96] }}
          transition={{ duration: profileDuration(profile, 2.55), times: [0, 0.18, 0.78, 1], ease: "easeOut" }}
          className={`absolute left-[62%] h-[70%] w-[86px] ${candleAnchor}`}
          style={{ transformOrigin: "center center", willChange: "transform, opacity" }}
        >
          <motion.div
            initial={{ scaleY: 0.04 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: profileDuration(profile, 0.74), delay: profileDuration(profile, 0.28), ease: [0.12, 0.85, 0.18, 1] }}
            className={`absolute left-1/2 h-[116%] w-[7px] -translate-x-1/2 rounded-full ${isBull ? "bottom-[-8%]" : "top-[-8%]"}`}
            style={{ background: color, boxShadow: `0 0 26px ${glow}`, transformOrigin: bodyOrigin }}
          />
          <motion.div
            initial={{ scaleY: 0.06 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: profileDuration(profile, 0.86), delay: profileDuration(profile, 0.34), ease: [0.12, 0.85, 0.18, 1] }}
            className={`absolute left-0 h-[72%] w-full rounded-[10px] border border-white/28 ${isBull ? "bottom-[12%]" : "top-[12%]"}`}
            style={{
              background: `linear-gradient(90deg, ${isBull ? "#07966f" : "#9b1230"}, ${color}, ${isBull ? "#c7ffef" : "#ffb3c0"})`,
              boxShadow: `0 0 42px ${glow}, inset 0 0 18px rgba(255,255,255,0.24)`,
              transformOrigin: bodyOrigin,
            }}
          />
          <motion.div
            initial={{ y: blastYs[0], opacity: 0, scaleX: 0.38 }}
            animate={{ y: blastYs, opacity: [0, 1, 0], scaleX: [0.38, 1.32, 0.7] }}
            transition={{ duration: profileDuration(profile, 0.74), delay: profileDuration(profile, 0.58), ease: "easeOut" }}
            className="absolute left-1/2 h-[6px] w-40 -translate-x-1/2 rotate-[-18deg] rounded-sm bg-[linear-gradient(90deg,transparent,#fff,var(--candle-blast),transparent)]"
            style={{ "--candle-blast": color, boxShadow: `0 0 34px ${glow}` } as CSSProperties}
          />
        </motion.div>
        {Array.from({ length: profileCount(profile, 24) }, (_, i) => {
          const seed = hash(`${event.id}-candle-${i}`);
          const left = 10 + (seed % 78);
          const delay = 0.24 + (seed % 10) * 0.035;
          const distance = 32 + (seed % 46);
          return (
            <motion.span
              key={`${event.id}-spark-${i}`}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.55 }}
              animate={{ opacity: [0, 1, 0], x: ((seed % 28) - 14), y: isBull ? -distance : distance, scale: [0.55, 1, 0.2] }}
              transition={{ duration: profileDuration(profile, 1.1 + (seed % 5) * 0.08), delay: profileDuration(profile, delay), ease: "easeOut" }}
              className="absolute h-[3px] w-10 rounded-sm"
              style={{ left: `${left}%`, top: isBull ? `${60 - (seed % 22)}%` : `${26 + (seed % 22)}%`, background: color, boxShadow: `0 0 18px ${glow}`, rotate: isBull ? "-24deg" : "24deg", willChange: "transform, opacity" }}
            />
          );
        })}
      </div>
      <HeroLabel event={event} title={`${ticker} ${isBull ? "green candle" : "red candle"}`} color={color} profile={profile} />
    </motion.div>
  );
}

function ShockStreaks({ color, side, count = 16, durationScale = 1 }: { color: string; side: "bull" | "bear"; count?: number; durationScale?: number }) {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: count }, (_, i) => (
        <motion.span
          key={`${side}-shock-${i}`}
          initial={{ opacity: 0, scaleX: 0.25, x: side === "bull" ? "-18vw" : "18vw" }}
          animate={{ opacity: [0, 0.68, 0], scaleX: [0.25, 1.15, 0.55], x: side === "bull" ? "98vw" : "-98vw" }}
          transition={{ duration: (0.82 + (i % 4) * 0.06) * durationScale, delay: i * 0.028 * durationScale, ease: "easeOut" }}
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

function HeroLabel({ event, title, color, profile }: { event: OverlayEngagementEvent; title: string; color: string; profile?: OverlayEffectProfile }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.86, filter: "blur(8px)" }}
      animate={{ opacity: [0, 1, 1, 0], y: [22, 0, 0, -10], scale: [0.86, 1.04, 1, 0.98], filter: ["blur(8px)", "blur(0px)", "blur(0px)", "blur(4px)"] }}
      transition={{ duration: profileDuration(profile, 2.55), times: [0, 0.2, 0.78, 1], ease: FX_EASE }}
      className="absolute bottom-[74px] left-1/2 -translate-x-1/2 overflow-hidden rounded-2xl px-5 py-2.5 text-center shadow-[0_20px_54px_rgba(0,0,0,0.62)] backdrop-blur-xl"
      style={{
        background: "linear-gradient(135deg, rgba(0,0,0,0.78), rgba(10,12,14,0.58))",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: `0 20px 54px rgba(0,0,0,0.62), 0 0 34px ${color}66, inset 0 1px 0 rgba(255,255,255,0.16)`,
      }}
    >
      <motion.div
        className="absolute inset-y-0 w-20 skew-x-[-18deg] bg-white/20"
        initial={{ x: "-130%" }}
        animate={{ x: "360%" }}
        transition={{ duration: profileDuration(profile, 0.82), delay: profileDuration(profile, 0.18), ease: "easeOut" }}
      />
      <div className="relative text-[10px] font-black uppercase tracking-[0.18em]" style={{ color }}>{event.user}</div>
      <div className="relative text-lg font-black uppercase tracking-[0.12em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">{title}</div>
    </motion.div>
  );
}

function TickerTape({ events, profile }: { events: OverlayEngagementEvent[]; profile?: OverlayEffectProfile }) {
  const duration = profileDuration(profile, 0.32);
  const alpha = profileAlpha(profile, 1);
  const color = profile?.accent ?? "#34d6ff";
  if (!events.length) return null;
  return (
    <div className="absolute bottom-2 left-2 right-[116px] flex min-w-0 gap-1.5 overflow-hidden rounded-full">
      {events.map((event) => (
        <motion.div
          key={event.id}
          initial={{ y: 18, opacity: 0, scale: 0.86, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration, ease: FX_EASE }}
          className="relative shrink-0 overflow-hidden rounded-full px-3.5 py-1.5 text-[13px] font-black text-[#bdf2ff] shadow-[0_0_22px_rgba(52,214,255,0.28)] backdrop-blur"
          style={{
            background: `linear-gradient(135deg, ${hexToRgba(color, 0.24)}, rgba(0,0,0,0.48))`,
            border: `1px solid ${hexToRgba(color, 0.36)}`,
            boxShadow: `0 0 22px ${hexToRgba(color, 0.28)}`,
            opacity: alpha,
          }}
        >
          <motion.span
            className="absolute inset-y-0 w-12 skew-x-[-18deg] bg-white/30"
            initial={{ x: "-140%" }}
            animate={{ x: "420%" }}
            transition={{ duration: profileDuration(profile, 0.95), delay: profileDuration(profile, 0.08), ease: "easeOut" }}
          />
          <span className="relative">${event.payload?.ticker ?? "BTC"} boosted by {event.user}</span>
        </motion.div>
      ))}
    </div>
  );
}

function EmoteBurst({ event, profile }: { event: OverlayEngagementEvent; profile?: OverlayEffectProfile }) {
  const emote = event.payload?.emote ?? "RKT";
  const asset = brandedEmoteAsset(event.actionId);
  const basePattern = emotePatternFor(event, asset, emote);
  const pattern = profile?.accent ? { ...basePattern, accent: profile.accent, glow: hexToRgba(profile.accent, 0.72) } : basePattern;
  const count = profileCount(profile, pattern.count);
  const alpha = profileAlpha(profile, 1);
  const scale = profile?.scale ?? 1;
  return (
    <>
      <EmotePatternBackdrop event={event} pattern={pattern} profile={profile} />
      {Array.from({ length: count }, (_, i) => {
        const seed = hash(`${event.id}-${i}`);
        const motionPreset = emoteParticleMotion(event.actionId, seed, i, count);
        const delay = motionPreset.delay ?? (seed % 9) * 0.035;
        const size = (pattern.sizeMin + (seed % pattern.sizeRange)) * scale;
        const depth = 0.78 + (seed % 34) / 100;
        const blur = seed % 5 === 0 ? "0.8px" : "0px";
        return (
          <motion.span
            key={`${event.id}-${i}`}
            initial={motionPreset.initial}
            animate={motionPreset.animate}
            exit={{ opacity: 0 }}
            transition={{ duration: profileDuration(profile, motionPreset.duration), delay: profileDuration(profile, delay), ease: motionPreset.ease ?? "easeOut" }}
            className="absolute font-black"
            style={{
              ...motionPreset.style,
              fontSize: size,
              zIndex: seed % 3,
              color: pattern.accent,
              textShadow: asset ? undefined : `0 0 14px ${pattern.glow}, 0 4px 12px rgba(0,0,0,0.7)`,
              filter: asset ? `blur(${blur}) drop-shadow(0 10px 18px rgba(0,0,0,0.62)) drop-shadow(0 0 15px ${pattern.glow})` : `blur(${blur}) drop-shadow(0 4px 12px rgba(0,0,0,0.68))`,
              perspective: 900,
              transformStyle: "preserve-3d",
              opacity: depth * alpha,
              willChange: "transform, opacity",
            }}
          >
            {asset ? <ImageEmote asset={asset} seed={seed} size={size} patternId={pattern.id} /> : <TextEmote pattern={pattern} seed={seed} size={size} />}
          </motion.span>
        );
      })}
    </>
  );
}

type EmoteAsset = { src: string; alt: string; glow: string; aspect?: string };
type EmotePattern = {
  id: string;
  symbol: string;
  accent: string;
  glow: string;
  count: number;
  sizeMin: number;
  sizeRange: number;
  chip?: boolean;
  backdrop?: "burst" | "scan" | "laser" | "moon" | "whale" | "rain" | "drop";
};

function emotePatternFor(event: OverlayEngagementEvent, asset: EmoteAsset | null, fallback: string): EmotePattern {
  switch (event.actionId) {
    case "ansem-emote":
      return { id: "ansem", symbol: "ANSEM", accent: "#f59e0b", glow: "rgba(245,158,11,0.7)", count: 24, sizeMin: 42, sizeRange: 22, backdrop: "burst" };
    case "banks-emote":
      return { id: "banks", symbol: "BANKS", accent: "#38bdf8", glow: "rgba(56,189,248,0.72)", count: 24, sizeMin: 42, sizeRange: 22, backdrop: "scan" };
    case "nelk-emote":
      return { id: "nelk", symbol: "NELK", accent: "#f8fafc", glow: "rgba(248,250,252,0.6)", count: 20, sizeMin: 42, sizeRange: 18, backdrop: "drop" };
    case "happy-dad-emote":
      return { id: "happy", symbol: "HAPPY DAD", accent: "#facc15", glow: "rgba(250,204,21,0.62)", count: 24, sizeMin: 36, sizeRange: 18, backdrop: "burst" };
    case "polymarket-emote":
      return { id: "poly", symbol: "POLY", accent: "#34d6ff", glow: "rgba(52,214,255,0.68)", count: 26, sizeMin: 34, sizeRange: 18, backdrop: "scan" };
    case "wagmi-meme":
      return { id: "wagmi", symbol: "WAGMI", accent: "#16e6a4", glow: "rgba(22,230,164,0.72)", count: 24, sizeMin: 20, sizeRange: 16, chip: true, backdrop: "burst" };
    case "ngmi-meme":
      return { id: "ngmi", symbol: "NGMI", accent: "#ff5c7a", glow: "rgba(255,92,122,0.72)", count: 22, sizeMin: 20, sizeRange: 16, chip: true, backdrop: "drop" };
    case "cope-meme":
      return { id: "cope", symbol: "COPE", accent: "#a78bfa", glow: "rgba(167,139,250,0.7)", count: 23, sizeMin: 20, sizeRange: 15, chip: true, backdrop: "burst" };
    case "send-it-meme":
      return { id: "send", symbol: "SEND IT", accent: "#f97316", glow: "rgba(249,115,22,0.72)", count: 26, sizeMin: 20, sizeRange: 16, chip: true, backdrop: "scan" };
    case "diamond-hands-meme":
      return { id: "diamond", symbol: "DIAMOND HANDS", accent: "#34d6ff", glow: "rgba(52,214,255,0.72)", count: 28, sizeMin: 18, sizeRange: 16, chip: true, backdrop: "rain" };
    case "laser-eyes-meme":
      return { id: "laser", symbol: "LASER EYES", accent: "#ef4444", glow: "rgba(239,68,68,0.72)", count: 18, sizeMin: 19, sizeRange: 14, chip: true, backdrop: "laser" };
    case "moon-meme":
      return { id: "moon", symbol: "TO THE MOON", accent: "#facc15", glow: "rgba(250,204,21,0.72)", count: 24, sizeMin: 18, sizeRange: 16, chip: true, backdrop: "moon" };
    case "dogecoin-meme":
      return { id: "doge", symbol: "DOGE", accent: "#d9a547", glow: "rgba(217,165,71,0.72)", count: 28, sizeMin: 18, sizeRange: 15, chip: true, backdrop: "rain" };
    case "whale-storm":
      return { id: "whale", symbol: "WHALE", accent: "#67e8f9", glow: "rgba(103,232,249,0.76)", count: 34, sizeMin: 22, sizeRange: 20, chip: true, backdrop: "whale" };
    default:
      return {
        id: asset ? "brand" : "burst",
        symbol: fallback,
        accent: asset ? "#ffffff" : "#facc15",
        glow: asset?.glow ?? "rgba(250,204,21,0.68)",
        count: asset ? 22 : 20,
        sizeMin: asset ? 42 : 20,
        sizeRange: asset ? 22 : 16,
        chip: !asset,
        backdrop: "burst",
      };
  }
}

function EmotePatternBackdrop({ event, pattern, profile }: { event: OverlayEngagementEvent; pattern: EmotePattern; profile?: OverlayEffectProfile }) {
  if (!pattern.backdrop) return null;

  if (pattern.backdrop === "laser") {
    return (
      <motion.div key={`${event.id}-laser-backdrop`} className="absolute inset-0">
        {[32, 44, 56].map((top, i) => (
          <motion.span
            key={`${event.id}-laser-${i}`}
            initial={{ opacity: 0, scaleX: 0, x: "-12vw" }}
            animate={{ opacity: [0, 1, 0], scaleX: [0, 1, 0.65], x: "38vw" }}
            transition={{ duration: profileDuration(profile, 0.72), delay: profileDuration(profile, i * 0.07), ease: "easeOut" }}
            className="absolute left-[12%] h-[5px] w-[76%] origin-left rounded-full bg-[linear-gradient(90deg,transparent,#fff,#ef4444,transparent)] shadow-[0_0_30px_rgba(239,68,68,0.78)]"
            style={{ top: `${top}%`, rotate: `${-5 + i * 5}deg` }}
          />
        ))}
      </motion.div>
    );
  }

  const origin = pattern.backdrop === "drop" ? "50% 20%" : pattern.backdrop === "moon" ? "50% 78%" : "50% 50%";
  const scale = pattern.backdrop === "whale" ? 1.8 : pattern.backdrop === "scan" ? 1.35 : 1.55;
  return (
    <>
      <motion.div
        key={`${event.id}-emote-backdrop`}
        initial={{ opacity: 0, scale: 0.64 }}
        animate={{ opacity: [0, profileAlpha(profile, 0.38), 0], scale: scale * (profile?.scale ?? 1) }}
        exit={{ opacity: 0 }}
        transition={{ duration: profileDuration(profile, pattern.backdrop === "whale" ? 2.8 : 1.7), ease: "easeOut" }}
        className="absolute inset-[-18%] rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle at ${origin}, ${pattern.accent}92, transparent 58%)` }}
      />
      <motion.div
        key={`${event.id}-emote-radial`}
        initial={{ opacity: 0, rotate: -8, scale: 0.92 }}
        animate={{ opacity: [0, profileAlpha(profile, 0.24), 0], rotate: 10, scale: 1.08 * (profile?.scale ?? 1) }}
        transition={{ duration: profileDuration(profile, pattern.backdrop === "whale" ? 2.4 : 1.35), ease: "easeOut" }}
        className="absolute inset-[-10%]"
        style={{
          backgroundImage: `repeating-conic-gradient(from 0deg at ${origin}, ${pattern.accent}44 0deg, transparent 8deg, transparent 18deg)`,
          maskImage: "radial-gradient(circle at 50% 50%, #000 0%, transparent 68%)",
        }}
      />
    </>
  );
}

function emoteParticleMotion(actionId: string, seed: number, index: number, count: number) {
  const left = 8 + (seed % 84);
  const top = 12 + (seed % 72);
  const spread = (seed % 42) - 21;
  const longSpread = (seed % 96) - 48;
  const lane = index / Math.max(1, count - 1);
  const ease = [0.16, 1, 0.3, 1] as const;

  switch (actionId) {
    case "ansem-emote":
      return {
        initial: { left: "50%", top: "50%", x: 0, y: 0, opacity: 0, scale: 0.2, rotate: -18 },
        animate: { x: [0, Math.cos(lane * Math.PI * 2) * 90, longSpread * 4], y: [0, Math.sin(lane * Math.PI * 2) * 55 - 50, -180 - (seed % 130)], opacity: [0, 1, 1, 0], scale: [0.2, 1.2, 1], rotate: [-18, 10 + spread, 38] },
        duration: 2.6 + (seed % 5) * 0.12,
        delay: index * 0.018,
        ease,
        style: {},
      };
    case "banks-emote":
      return {
        initial: { x: "112vw", y: 0, opacity: 0, scale: 0.75, rotate: 10 },
        animate: { x: "-18vw", y: [0, -18, 14, -8], opacity: [0, 1, 1, 0], scale: [0.75, 1.08, 0.95], rotate: [10, -8, 4] },
        duration: 2.1 + (seed % 5) * 0.13,
        delay: index * 0.018,
        ease,
        style: { left: "-8%", top: `${16 + ((index * 11 + seed) % 68)}%` },
      };
    case "nelk-emote":
      return {
        initial: { y: "-18vh", opacity: 0, scale: 1.35, rotate: -28 },
        animate: { y: ["-18vh", `${16 + (seed % 46)}vh`, `${12 + (seed % 42)}vh`, "108vh"], x: [0, spread, -spread, spread * 0.4], opacity: [0, 1, 1, 0], scale: [1.35, 0.98, 1.08, 0.72], rotate: [-28, 8, -5, 18] },
        duration: 2.65 + (seed % 4) * 0.14,
        delay: index * 0.02,
        ease,
        style: { left: `${left}%`, top: "0%" },
      };
    case "happy-dad-emote":
      return {
        initial: { y: "104vh", opacity: 0, scale: 0.45, rotate: -12 },
        animate: { y: ["104vh", `${72 - (seed % 34)}vh`, "-12vh"], x: [0, spread * 1.4, -spread * 0.8, spread], opacity: [0, 1, 1, 0], scale: [0.45, 1.12, 0.92], rotate: [-12, 12, -8, 18] },
        duration: 3.1 + (seed % 7) * 0.1,
        delay: (seed % 8) * 0.035,
        ease,
        style: { left: `${left}%` },
      };
    case "polymarket-emote":
      return {
        initial: { x: "-18vw", y: "82vh", opacity: 0, scale: 0.72, rotate: -10 },
        animate: { x: "112vw", y: "-12vh", opacity: [0, 1, 1, 0], scale: [0.72, 1.04, 0.9], rotate: [-10, 0, 12] },
        duration: 2.3 + (seed % 5) * 0.12,
        delay: index * 0.015,
        ease,
        style: { left: `${-8 + (index % 5) * 6}%`, top: `${70 - lane * 58}%` },
      };
    case "wagmi-meme":
      return diagonalRiseMotion(left, seed, index);
    case "ngmi-meme":
      return dropMotion(left, seed, index);
    case "cope-meme":
      return wobbleMotion(left, top, seed, index);
    case "send-it-meme":
      return sendMotion(seed, index);
    case "diamond-hands-meme":
      return rainMotion(left, seed, index, "diamond");
    case "laser-eyes-meme":
      return laserMotion(top, seed, index);
    case "moon-meme":
      return moonMotion(seed, index, lane);
    case "dogecoin-meme":
      return coinMotion(left, seed, index);
    case "whale-storm":
      return whaleMotion(seed, index, lane);
    default:
      return {
        initial: { y: "105vh", x: 0, opacity: 0, rotate: -18, scale: 0.8 },
        animate: { y: "-16vh", x: spread, opacity: [0, 1, 1, 0], rotate: 22, scale: [0.8, 1.08, 0.92] },
        duration: 3.2 + (seed % 7) * 0.18,
        delay: (seed % 9) * 0.035,
        ease: "easeOut",
        style: { left: `${left}%` },
      };
  }
}

function diagonalRiseMotion(left: number, seed: number, index: number) {
  const spread = (seed % 52) - 26;
  return {
    initial: { y: "104vh", x: -40, opacity: 0, rotate: -10, scale: 0.72 },
    animate: { y: "-14vh", x: 90 + spread, opacity: [0, 1, 1, 0], rotate: [-10, 4, 16], scale: [0.72, 1.1, 0.96] },
    duration: 2.45 + (seed % 6) * 0.12,
    delay: index * 0.018,
    ease: [0.16, 1, 0.3, 1] as const,
    style: { left: `${left}%` },
  };
}

function dropMotion(left: number, seed: number, index: number) {
  return {
    initial: { y: "-16vh", x: 0, opacity: 0, rotate: 12, scale: 1.05 },
    animate: { y: "112vh", x: [(seed % 38) - 19, (seed % 70) - 35, (seed % 44) - 22], opacity: [0, 1, 1, 0], rotate: [12, -18, 24], scale: [1.05, 0.95, 0.82] },
    duration: 2.55 + (seed % 5) * 0.15,
    delay: index * 0.018,
    ease: "easeIn",
    style: { left: `${left}%` },
  };
}

function wobbleMotion(left: number, top: number, seed: number, index: number) {
  const sway = 28 + (seed % 32);
  return {
    initial: { opacity: 0, scale: 0.4, rotate: -12 },
    animate: { opacity: [0, 1, 1, 0], x: [0, sway, -sway, sway * 0.55], y: [16, -20, 12, -54], scale: [0.4, 1.08, 0.92], rotate: [-12, 14, -18, 8] },
    duration: 2.35 + (seed % 5) * 0.16,
    delay: index * 0.022,
    ease: "easeOut",
    style: { left: `${left}%`, top: `${top}%` },
  };
}

function sendMotion(seed: number, index: number) {
  return {
    initial: { x: "-24vw", opacity: 0, scaleX: 0.78, rotate: -7 },
    animate: { x: "116vw", opacity: [0, 1, 0], scaleX: [0.78, 1.18, 0.86], rotate: [-7, 1, 7] },
    duration: 1.42 + (seed % 4) * 0.1,
    delay: index * 0.012,
    ease: [0.12, 0.8, 0.18, 1] as const,
    style: { left: "-12%", top: `${12 + ((index * 9 + seed) % 74)}%` },
  };
}

function rainMotion(left: number, seed: number, index: number, mode: "diamond" | "coin") {
  return {
    initial: { y: "-18vh", opacity: 0, rotateY: 0, rotate: -8, scale: 0.78 },
    animate: { y: "112vh", x: [(seed % 30) - 15, (seed % 52) - 26], opacity: [0, 1, 1, 0], rotateY: [0, 180, 360], rotate: [-8, 8, -4], scale: mode === "diamond" ? [0.78, 1.12, 0.9] : [0.84, 1.18, 0.88] },
    duration: 2.7 + (seed % 6) * 0.12,
    delay: index * 0.014,
    ease: "easeIn",
    style: { left: `${left}%`, transformStyle: "preserve-3d" as const },
  };
}

function laserMotion(top: number, seed: number, index: number) {
  return {
    initial: { x: "-18vw", opacity: 0, scale: 0.78, rotate: -4 },
    animate: { x: "112vw", opacity: [0, 1, 0], scale: [0.78, 1.06, 0.9], rotate: [-4, 0, 4] },
    duration: 1.2 + (seed % 4) * 0.08,
    delay: index * 0.018,
    ease: "easeOut",
    style: { left: "-12%", top: `${top}%` },
  };
}

function moonMotion(seed: number, index: number, lane: number) {
  const arc = -220 - (seed % 160);
  return {
    initial: { left: `${12 + lane * 76}%`, top: "92%", x: 0, y: 0, opacity: 0, scale: 0.55, rotate: -24 },
    animate: { x: [(seed % 48) - 24, (seed % 90) - 45], y: [0, arc * 0.45, arc], opacity: [0, 1, 1, 0], scale: [0.55, 1.15, 0.88], rotate: [-24, 12, 42] },
    duration: 2.5 + (seed % 6) * 0.13,
    delay: index * 0.016,
    ease: [0.16, 1, 0.3, 1] as const,
    style: {},
  };
}

function coinMotion(left: number, seed: number, index: number) {
  const base = rainMotion(left, seed, index, "coin");
  return { ...base, duration: 2.45 + (seed % 6) * 0.12 };
}

function whaleMotion(seed: number, index: number, lane: number) {
  return {
    initial: { x: "-26vw", y: `${74 - lane * 50}vh`, opacity: 0, scale: 0.62, rotate: -5 },
    animate: { x: "116vw", y: [`${74 - lane * 50}vh`, `${68 - lane * 48}vh`, `${72 - lane * 54}vh`], opacity: [0, 1, 1, 0], scale: [0.62, 1.14, 0.9], rotate: [-5, 4, -2] },
    duration: 2.7 + (seed % 5) * 0.16,
    delay: index * 0.018,
    ease: [0.12, 0.8, 0.18, 1] as const,
    style: { left: "-10%", top: "0%" },
  };
}

function TextEmote({ pattern, seed, size }: { pattern: EmotePattern; seed: number; size: number }) {
  const twist = (seed % 16) - 8;
  const text = decorateEmoteText(pattern, seed);
  if (!pattern.chip) {
    return <span style={{ transform: `rotate(${twist}deg)`, display: "inline-block" }}>{text}</span>;
  }
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 uppercase tracking-[0.08em]"
      style={{
        minHeight: Math.max(28, size * 1.4),
        borderColor: `${pattern.accent}88`,
        background: `linear-gradient(135deg, ${pattern.accent}24, rgba(0,0,0,0.62))`,
        boxShadow: `0 0 22px ${pattern.glow}, inset 0 0 14px rgba(255,255,255,0.08)`,
        transform: `rotate(${twist}deg)`,
      }}
    >
      {text}
    </span>
  );
}

function decorateEmoteText(pattern: EmotePattern, seed: number): string {
  switch (pattern.id) {
    case "diamond":
      return seed % 2 ? "DIAMOND" : "HANDS";
    case "laser":
      return seed % 2 ? "LASER" : "EYES";
    case "moon":
      return seed % 3 === 0 ? "MOON" : seed % 3 === 1 ? "LAUNCH" : "UP ONLY";
    case "doge":
      return seed % 2 ? "DOGE" : "WOW";
    case "whale":
      return seed % 2 ? "WHALE" : "SIZE";
    default:
      return pattern.symbol;
  }
}

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

function ImageEmote({ asset, seed, size, patternId }: { asset: EmoteAsset; seed: number; size: number; patternId: string }) {
  const tilt = (seed % 18) - 9;
  const width = asset.aspect === "wide" ? size * 1.72 : asset.aspect === "auto" ? size * 1.18 : size;
  const radius = patternId === "nelk" || patternId === "happy" || patternId === "poly" ? "10px" : "999px";
  return (
    <span
      className="relative inline-grid place-items-center overflow-hidden"
      style={{
        width,
        height: size,
        borderRadius: radius,
        transform: `rotate(${tilt}deg)`,
        background: patternId === "ansem" || patternId === "banks" ? "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.24), rgba(0,0,0,0.38) 68%)" : "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(0,0,0,0.24))",
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.22), 0 14px 28px rgba(0,0,0,0.45), 0 0 22px ${asset.glow}`,
      }}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_28%,rgba(255,255,255,0.34)_48%,transparent_68%)] opacity-60" />
      <img
        src={asset.src}
        alt={asset.alt}
        draggable={false}
        className="relative block h-full w-full select-none object-contain"
        style={{ borderRadius: radius }}
      />
    </span>
  );
}

function ColorWave({ event, profile }: { event: OverlayEngagementEvent; profile?: OverlayEffectProfile }) {
  const color = profile?.accent ?? event.payload?.color ?? "#d9a547";
  const alpha = profileAlpha(profile, 1);
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.66, rotate: -10 }}
        animate={{ opacity: [0, 0.42 * alpha, 0], scale: 1.65 * (profile?.scale ?? 1), rotate: 10 }}
        exit={{ opacity: 0 }}
        transition={{ duration: profileDuration(profile, 2.45), ease: "easeOut" }}
        className="absolute inset-[-22%] rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle at 50% 50%, ${color}, transparent 58%)` }}
      />
      <motion.div
        initial={{ opacity: 0, x: "-28vw", scaleX: 0.4 }}
        animate={{ opacity: [0, 0.68 * alpha, 0], x: "120vw", scaleX: [0.4, 1.25 * (profile?.scale ?? 1), 0.7] }}
        transition={{ duration: profileDuration(profile, 1.22), ease: IMPACT_EASE }}
        className="absolute left-0 top-1/2 h-[34vh] w-[42vw] -translate-y-1/2 skew-x-[-14deg] blur-xl"
        style={{ background: `linear-gradient(90deg, transparent, ${color}88, rgba(255,255,255,0.35), transparent)` }}
      />
    </>
  );
}

function Spotlight({ event, profile }: { event: OverlayEngagementEvent; profile?: OverlayEffectProfile }) {
  const accent = profile?.accent ?? "#d9a547";
  const alpha = profileAlpha(profile, 1);
  const scale = profile?.scale ?? 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: -22, scale: 0.92, filter: "blur(8px)" }}
      animate={{ opacity: alpha, y: 0, scale, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
      transition={{ duration: profileDuration(profile, 0.38), ease: FX_EASE }}
      className="absolute left-1/2 top-[110px] w-[min(76%,760px)] -translate-x-1/2 overflow-hidden rounded-2xl p-3.5 text-center shadow-[0_24px_60px_rgba(0,0,0,0.62)] backdrop-blur-xl"
      style={{
        background: `linear-gradient(135deg, ${accent}2e, rgba(0,0,0,0.72) 42%, rgba(52,214,255,0.1))`,
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: `0 24px 60px rgba(0,0,0,0.62), 0 0 32px ${accent}3d, inset 0 1px 0 rgba(255,255,255,0.14)`,
      }}
    >
      <motion.div
        className="absolute inset-y-0 w-24 skew-x-[-18deg] bg-white/20"
        initial={{ x: "-130%" }}
        animate={{ x: "740%" }}
        transition={{ duration: profileDuration(profile, 1.05), delay: profileDuration(profile, 0.1), ease: "easeOut" }}
      />
      <div className="relative text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Viewer Spotlight · {event.user}</div>
      <div className="relative mt-1 text-xl font-black leading-tight text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.8)]">{event.payload?.message || "W stream."}</div>
    </motion.div>
  );
}

function ClipBoost({ event, profile }: { event: OverlayEngagementEvent; profile?: OverlayEffectProfile }) {
  const accent = profile?.accent ?? "#f97316";
  const alpha = profileAlpha(profile, 1);
  const scale = profile?.scale ?? 1;
  return (
    <motion.div
      initial={{ opacity: 0, x: 38, scale: 0.9, filter: "blur(5px)" }}
      animate={{ opacity: alpha, x: 0, scale, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 24, filter: "blur(4px)" }}
      transition={{ duration: profileDuration(profile, 0.32), ease: FX_EASE }}
      className="absolute right-2 top-[64px] overflow-hidden rounded-2xl px-3.5 py-2.5 text-right shadow-[0_18px_44px_rgba(0,0,0,0.48)] backdrop-blur-xl"
      style={{
        background: `linear-gradient(135deg, ${accent}42, rgba(0,0,0,0.66))`,
        border: `1px solid ${accent}66`,
        boxShadow: `0 18px 44px rgba(0,0,0,0.48), 0 0 26px ${accent}42`,
      }}
    >
      <motion.div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: profileDuration(profile, 0.72), repeat: 2 }} />
      <div className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: accent }}>Clip Boost</div>
      <div className="text-sm font-black text-white">{event.user} marked this</div>
    </motion.div>
  );
}

function Soundwave({ event, profile }: { event: OverlayEngagementEvent; profile?: OverlayEffectProfile }) {
  const count = profileCount(profile, 18);
  const accent = profile?.accent ?? "#a78bfa";
  const alpha = profileAlpha(profile, 1);
  const scale = profile?.scale ?? 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.92, filter: "blur(6px)" }}
      animate={{ opacity: alpha, y: 0, scale, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      transition={{ duration: profileDuration(profile, 0.32), ease: FX_EASE }}
      className="absolute bottom-[58px] left-1/2 flex -translate-x-1/2 items-end gap-1 overflow-hidden rounded-full px-5 py-2.5 backdrop-blur-xl"
      style={{
        background: `linear-gradient(135deg, ${accent}3d, rgba(0,0,0,0.58))`,
        border: `1px solid ${accent}61`,
        boxShadow: `0 18px 44px rgba(0,0,0,0.48), 0 0 28px ${accent}4d`,
      }}
    >
      <motion.div
        className="absolute inset-[-40%] rounded-full blur-xl"
        style={{ background: hexToRgba(accent, 0.2) }}
        animate={{ scale: [0.8, 1.2, 0.9], opacity: [0.25, profileAlpha(profile, 0.55), 0.2] }}
        transition={{ duration: profileDuration(profile, 0.72), repeat: 3, ease: "easeInOut" }}
      />
      {Array.from({ length: count }, (_, i) => (
        <motion.span
          key={`${event.id}-${i}`}
          className="relative block w-1 rounded-full"
          style={{ background: accent, boxShadow: `0 0 12px ${hexToRgba(accent, 0.72)}` }}
          animate={{ height: [8, 30 + ((i * 7) % 28), 12, 24 + ((i * 5) % 18), 8] }}
          transition={{ duration: profileDuration(profile, 0.86), repeat: 3, delay: profileDuration(profile, i * 0.02), ease: "easeInOut" }}
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

function playOverlayHeroSfx(event: OverlayEngagementEvent, profile?: OverlayEffectProfile): void {
  try {
    const audioScale = profile?.audio ?? 1;
    if (audioScale <= 0.01) return;
    const now = Date.now();
    if (now - lastHeroAudioAt < AUDIO_COOLDOWN_MS) return;
    lastHeroAudioAt = now;
    const ctx = getOverlayAudioContext();
    if (!ctx) return;
    void ctx.resume().catch(() => undefined);
    const start = ctx.currentTime + 0.03;
    if (event.actionId === "charging-bull") {
      playChargingBullSfx(ctx, start, audioScale);
    } else if (event.actionId === "bear-slash") {
      playBearSlashSfx(ctx, start, audioScale);
    } else if (event.actionId === "chart-pump") {
      playChartCandleSfx(ctx, start, "bull", audioScale);
    } else if (event.actionId === "chart-dump") {
      playChartCandleSfx(ctx, start, "bear", audioScale);
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

function playChargingBullSfx(ctx: AudioContext, start: number, volumeScale = 1): void {
  const master = createEffectMaster(ctx, start, 2.75, 0.22 * volumeScale);

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

function playBearSlashSfx(ctx: AudioContext, start: number, volumeScale = 1): void {
  const master = createEffectMaster(ctx, start, 2.45, 0.23 * volumeScale);

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

function playChartCandleSfx(ctx: AudioContext, start: number, side: "bull" | "bear", volumeScale = 1): void {
  const isBull = side === "bull";
  const master = createEffectMaster(ctx, start, 2.25, 0.21 * volumeScale);

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
