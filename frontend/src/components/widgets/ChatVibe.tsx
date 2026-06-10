import { useMemo, useRef } from "react";
import { Activity, Repeat2, Hash } from "lucide-react";
import { useChatStore } from "@/store/chatStore";

/** Sentiment buckets — first matching keyword/emoji wins per message. */
const VIBES: { key: string; color: string; kw: RegExp }[] = [
  { key: "hype", color: "#16e6a4", kw: /🚀|🔥|lfg|bullish|pump|wagmi|moon|lets ?go|let's ?go|\bgm\b/i },
  { key: "funny", color: "#f5c518", kw: /😂|🤣|💀|lol|lmao|lmfao|kek|\blul\b|haha/i },
  { key: "shock", color: "#3b82f6", kw: /😱|👀|wtf|no ?way|omg|insane|holy|crazy/i },
  { key: "rekt", color: "#ff5a6a", kw: /📉|rekt|\brip\b|ngmi|dump|down ?bad|oof|rug/i },
  { key: "rage", color: "#ff8a00", kw: /🤬|😡|trash|scam|garbage|cope|\bmad\b/i },
];

const STOP = new Set("the a an and or but to of in on for is are am be it its that this these those you your yo we they he she his her them my me at as so do did does done with from have has had will would can could just like now get got was were not no yes if then than too very also out up off about over into".split(" "));

export function ChatVibe() {
  const messages = useChatStore((s) => s.messages);
  const peakRef = useRef(0);

  const v = useMemo(() => {
    const now = Date.now();
    const recent = messages.filter((m) => now - m.timestamp < 90_000);
    const active = new Set(recent.map((m) => `${m.platform}:${m.username.toLowerCase()}`)).size;
    const perSec = recent.length / 90;

    // vibe distribution
    const counts: Record<string, number> = { hype: 0, funny: 0, shock: 0, rekt: 0, rage: 0 };
    let classified = 0;
    for (const m of recent) {
      const hit = VIBES.find((x) => x.kw.test(m.message));
      if (hit) { counts[hit.key]++; classified++; }
    }
    const vibes = VIBES.map((x) => ({ ...x, pct: classified ? Math.round((counts[x.key] / classified) * 100) : 0 }));

    // ECHO — most-spammed words/short phrases
    const freq = new Map<string, number>();
    for (const m of recent) {
      for (const raw of m.message.split(/\s+/)) {
        const w = raw.replace(/[^\p{L}\p{N}$#]/gu, "");
        if (w.length < 2 || STOP.has(w.toLowerCase())) continue;
        const key = /^[A-Z0-9$#]+$/.test(w) ? w : w.toLowerCase(); // keep GG / LMAO / $TICKER as-is
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }
    }
    const top = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { active, perSec, total: recent.length, vibes, top };
  }, [messages]);

  if (v.active > peakRef.current) peakRef.current = v.active;
  const lead = [...v.vibes].sort((a, b) => b.pct - a.pct)[0];

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Activity size={14} className="text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Chat Vibe</span>
        {lead && lead.pct > 0 && <span className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-black uppercase" style={{ color: lead.color, background: `${lead.color}22` }}>{lead.key}</span>}
      </div>

      {/* pulse stats */}
      <div className="grid grid-cols-3 gap-1.5">
        {[["active", v.active], ["msgs/s", v.perSec.toFixed(1)], ["peak", peakRef.current]].map(([l, val]) => (
          <div key={l} className="rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1.5 text-center">
            <div className="text-[15px] font-black tabular-nums text-ink">{val}</div>
            <div className="text-[8px] uppercase tracking-wider text-faint">{l}</div>
          </div>
        ))}
      </div>

      {/* vibe bar */}
      <div className="mt-3">
        <div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-faint">Vibe · 90s</div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
          {v.vibes.map((x) => x.pct > 0 && <div key={x.key} style={{ width: `${x.pct}%`, background: x.color }} title={`${x.key} ${x.pct}%`} />)}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {v.vibes.map((x) => (
            <span key={x.key} className="flex items-center gap-1 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: x.color }} />
              <span className="capitalize text-muted">{x.key}</span>
              <span className="font-bold tabular-nums text-ink">{x.pct}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* ECHO — top words */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-faint"><Repeat2 size={11} /> Echo · what chat is spamming</div>
        <div className="vc-scroll flex-1 space-y-1 overflow-y-auto">
          {v.top.length === 0 && <div className="grid h-full place-items-center text-[11px] text-faint">listening to chat…</div>}
          {v.top.map(([word, n], i) => {
            const max = v.top[0][1];
            return (
              <div key={word} className="relative flex items-center gap-2 overflow-hidden rounded-lg border border-white/8 px-2.5 py-1.5">
                <div className="absolute inset-y-0 left-0 -z-0 rounded-lg bg-accent/10" style={{ width: `${(n / max) * 100}%` }} />
                <Hash size={11} className="z-10 text-faint" />
                <span className="z-10 flex-1 truncate text-[13px] font-bold text-ink">{word}</span>
                <span className="z-10 text-[12px] font-black tabular-nums text-accent">×{n}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
