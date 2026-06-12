import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { engageUrl, qrImageUrl, subscribeOverlayEvents, type OverlayEngagementEvent } from "@/lib/overlayEngagement";
import { compact } from "@/lib/format";

const TTL = 9000;

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

  useEffect(() => {
    const unsub = subscribeOverlayEvents(room, (event) => {
      setEvents((prev) => [event, ...prev].slice(0, 20));
      if (event.payload?.side) {
        setVotes((v) => ({ ...v, [event.payload!.side!]: v[event.payload!.side!] + 1 }));
      }
      if (event.kind === "boss") {
        setBoss((hp) => Math.max(0, hp - (event.payload?.damage ?? 12)));
      }
    });
    return unsub;
  }, [room]);

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
  const bullPct = Math.round((votes.bull / (votes.bull + votes.bear)) * 100);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <AnimatePresence>
        {latestWave && <ColorWave key={latestWave.id} event={latestWave} />}
        {visible.filter((e) => e.kind === "emote").slice(0, 4).map((event) => <EmoteBurst key={event.id} event={event} />)}
        {latestSpotlight && <Spotlight key={latestSpotlight.id} event={latestSpotlight} />}
        {latestClip && <ClipBoost key={latestClip.id} event={latestClip} />}
        {latestSound && <Soundwave key={latestSound.id} event={latestSound} />}
      </AnimatePresence>

      <SentimentMeter bullPct={bullPct} />
      <BossBar hp={boss} />
      {tickerEvents.length > 0 && <TickerTape events={tickerEvents} />}
    </div>
  );
}

function SentimentMeter({ bullPct }: { bullPct: number }) {
  return (
    <div className="absolute left-2 top-[64px] w-24 rounded-xl border border-white/10 bg-black/45 p-2 backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.12em] text-white/48">
        <span>Bull</span><span>Bear</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#ff5c7a]/45">
        <motion.div className="h-full rounded-full bg-[#16e6a4]" animate={{ width: `${bullPct}%` }} transition={{ type: "spring", stiffness: 170, damping: 22 }} />
      </div>
      <div className="mt-1 text-center text-[13px] font-black tabular-nums text-white">{bullPct}% bull</div>
    </div>
  );
}

function BossBar({ hp }: { hp: number }) {
  if (hp >= 99) return null;
  return (
    <div className="absolute left-1/2 top-[64px] w-[42%] -translate-x-1/2 rounded-xl border border-red-400/35 bg-black/55 p-2 backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-red-200">
        <span>FUD Boss</span><span>{compact(hp)} HP</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-red-950">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-300" animate={{ width: `${hp}%` }} />
      </div>
    </div>
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
  const count = event.actionId === "whale-storm" ? 34 : 18;
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
            {emote}
          </motion.span>
        );
      })}
    </>
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

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
