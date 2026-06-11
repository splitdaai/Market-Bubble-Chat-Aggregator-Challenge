import { useMemo, useState, useEffect } from "react";
import { ClipboardList, Hash, MessageCircleQuestion, Scissors, TrendingUp, RefreshCw } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";

/**
 * Producer Brief — a glanceable rundown for the host/producer, derived live
 * from the last few minutes of chat: what chat is talking about, tickers in
 * play, the room's mood, a suggested host question, the latest clip-worthy
 * moment, and any Polymarket chatter. Pure client-side derivation.
 */

const WINDOW_MS = 4 * 60_000;
const STOP = new Set(
  "the a an and or but is are was were be to of in on for with this that it its im i you we they he she at as so just like really very too going gonna got get my your our their what who when how why not no yes lol lmao haha w l chat stream live one all out up down if can will do does did about more some any them us me him her bro dude man".split(" "),
);
const POS = /moon|pump|bull|send|cook|fire|insane|love|best|great|win|green|up only|lfg|let'?s go|w\b/i;
const NEG = /dump|bear|rug|rekt|down|crash|hate|worst|trash|red|pain|cooked|ngmi|sell/i;

export function ProducerBrief() {
  const messages = useChatStore((s) => s.messages);
  const clipMoments = useStatsStore((s) => s.snapshot.clipMoments);
  const [, force] = useState(0);
  useEffect(() => { const iv = setInterval(() => force((x) => x + 1), 15_000); return () => clearInterval(iv); }, []);

  const brief = useMemo(() => {
    const now = Date.now();
    const recent = messages.filter((m) => now - m.timestamp < WINDOW_MS);

    // topics: word frequency with a stoplist
    const freq = new Map<string, number>();
    const tickers = new Map<string, number>();
    let pos = 0, neg = 0;
    let polyMention: string | null = null;
    let question: string | null = null;
    for (const m of recent) {
      if (POS.test(m.message)) pos++;
      if (NEG.test(m.message)) neg++;
      if (/polymarket|odds|the market says|prediction market/i.test(m.message)) polyMention = m.message;
      if (/\?\s*$/.test(m.message) && m.message.length > 12 && !question) question = m.message;
      for (const raw of m.message.split(/\s+/)) {
        const tk = raw.match(/^\$([A-Za-z]{2,6})$/)?.[1];
        if (tk) { tickers.set(tk.toUpperCase(), (tickers.get(tk.toUpperCase()) ?? 0) + 1); continue; }
        const w = raw.toLowerCase().replace(/[^a-z0-9']/g, "");
        if (w.length < 3 || STOP.has(w)) continue;
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
    }
    const topics = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const topTickers = [...tickers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const moodPct = pos + neg ? Math.round((pos / (pos + neg)) * 100) : 50;
    const lastClip = clipMoments[0] ?? null;

    // a suggested question for the host, built from what the room cares about
    const subject = topTickers[0]?.[0] ? `$${topTickers[0][0]}` : topics[0]?.[0] ?? null;
    const suggested = question
      ? `Chat is asking: “${question.slice(0, 90)}”`
      : subject
        ? `Ask the room: “Where does ${subject} go from here — and who's positioned for it?”`
        : "Ask the room what they want covered next.";

    return { count: recent.length, topics, topTickers, moodPct, polyMention, suggested, lastClip };
  }, [messages, clipMoments]);

  const mood = brief.moodPct >= 60 ? { label: "Bullish", c: "#16e6a4" } : brief.moodPct <= 40 ? { label: "Bearish", c: "#ff5a6a" } : { label: "Mixed", c: "#f5c452" };

  const Row = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-faint">{icon} {label}</div>
      <div className="text-[12px] leading-snug text-ink/90">{children}</div>
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-0.5">
      <div className="flex items-center gap-2 text-[10px] text-faint">
        <RefreshCw size={11} className="text-accent" />
        Auto-refreshing rundown from the last 4 min of chat · {brief.count} msgs
        <span className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-black uppercase" style={{ color: mood.c, background: `${mood.c}1f` }}>{mood.label} {brief.moodPct}%</span>
      </div>

      <Row icon={<ClipboardList size={11} />} label="Chat is talking about">
        {brief.topics.length ? (
          <span className="flex flex-wrap gap-1.5">
            {brief.topics.map(([w, n]) => (
              <span key={w} className="rounded bg-white/6 px-1.5 py-0.5 font-semibold">{w} <span className="text-faint">×{n}</span></span>
            ))}
          </span>
        ) : "Warming up — waiting for chat volume."}
      </Row>

      <Row icon={<Hash size={11} />} label="Tickers in play">
        {brief.topTickers.length ? (
          <span className="flex flex-wrap gap-1.5">
            {brief.topTickers.map(([tk, n]) => (
              <span key={tk} className="rounded bg-accent/12 px-1.5 py-0.5 font-bold text-accent">${tk} <span className="opacity-60">×{n}</span></span>
            ))}
          </span>
        ) : "No tickers being spammed right now."}
      </Row>

      <Row icon={<MessageCircleQuestion size={11} />} label="Suggested host beat">{brief.suggested}</Row>

      <Row icon={<Scissors size={11} />} label="Clip-worthy moment">
        {brief.lastClip
          ? `Chat spiked ${Math.max(1, Math.round((Date.now() - brief.lastClip.t) / 60_000))}m ago (${brief.lastClip.intensity.toFixed(1)}× baseline) — clip it from the Live tab.`
          : "No spike yet — the Clip Radar fires when chat velocity jumps."}
      </Row>

      <Row icon={<TrendingUp size={11} />} label="Polymarket chatter">
        {brief.polyMention ? `“${brief.polyMention.slice(0, 110)}”` : "No odds talk in the window — the Polymarket panel has live markets to bring up."}
      </Row>
    </div>
  );
}
