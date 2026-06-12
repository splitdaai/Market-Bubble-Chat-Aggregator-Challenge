import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Coins, MessageSquareText, Radio, Sparkles, Zap } from "lucide-react";
import { OVERLAY_ACTIONS, canAfford, publishOverlayEvent, roomFromSearch, spendBucks, type OverlayActionDef } from "@/lib/overlayEngagement";
import { compact } from "@/lib/format";
import { useBucksLedger } from "@/store/bucksLedgerStore";

const BALANCE_KEY = "market-bubble-engage-balance";
const USER_KEY = "market-bubble-engage-user";
const DEFAULT_BALANCE = 1200;
const SEND_COOLDOWN_MS = 450;
const TICKERS = ["BTC", "ETH", "SOL", "HYPE", "DOGE", "XRP", "NVDA", "COIN", "MSTR", "POLY"];
const EMOTES = ["🫧", "🚀", "🐂", "💎", "🔥", "W", "📈", "🟢", "👑", "⚡"];
const COLORS = ["#16e6a4", "#d9a547", "#34d6ff", "#f97316", "#a78bfa", "#ff5c7a"];
const SIDE_BY_ACTION: Record<string, "bull" | "bear"> = {
  "bull-vote": "bull",
  "charging-bull": "bull",
  "bear-vote": "bear",
  "bear-slash": "bear",
};
const EMOTE_BY_ACTION: Record<string, string> = {
  "ansem-emote": "ANSEM",
  "banks-emote": "BANKS",
  "nelk-emote": "NELK",
  "happy-dad-emote": "HAPPY DAD",
  "polymarket-emote": "POLY",
};

function storedNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function storedUser(): string {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return raw;
  } catch { /* ignore */ }
  return `bubble${Math.floor(1000 + Math.random() * 9000)}`;
}

export function EngagePage() {
  const room = useMemo(() => roomFromSearch(), []);
  const [balance, setBalance] = useState(() => storedNumber(BALANCE_KEY, DEFAULT_BALANCE));
  const [user, setUser] = useState(() => storedUser());
  const [ticker, setTicker] = useState(TICKERS[0]);
  const [emote, setEmote] = useState(EMOTES[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [message, setMessage] = useState("W stream. Run it up.");
  const [last, setLast] = useState<string>("Ready to move the overlay.");
  const [isSending, setIsSending] = useState(false);
  const sendLockedUntil = useRef(0);
  const releaseTimer = useRef<number | null>(null);

  const saveBalance = (n: number) => {
    setBalance(n);
    try { localStorage.setItem(BALANCE_KEY, String(n)); } catch { /* ignore */ }
  };
  const saveUser = (next: string) => {
    setUser(next);
    try { localStorage.setItem(USER_KEY, next); } catch { /* ignore */ }
  };
  const lockSend = () => {
    sendLockedUntil.current = Date.now() + SEND_COOLDOWN_MS;
    setIsSending(true);
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => {
      releaseTimer.current = null;
      setIsSending(false);
    }, SEND_COOLDOWN_MS);
  };

  useEffect(() => () => {
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
  }, []);

  const fire = (action: OverlayActionDef) => {
    const isClearAction = action.id === "clear-overlay";
    if (!isClearAction && Date.now() < sendLockedUntil.current) return;
    if (!canAfford(balance, action)) {
      setLast(`Need ${compact(action.cost - balance)} more Bubble Bucks for ${action.label}.`);
      return;
    }
    if (!isClearAction) lockSend();
    const next = spendBucks(balance, action);
    saveBalance(next);
    // Record the spend in the persistent BB ledger so the analytics page tracks
    // lifetime spending per viewer. Engage-page viewers identify by their X
    // handle (the only platform that can route an anonymous QR scan back to a
    // real account here); guest viewers fall back to "@bubbleguest".
    if (action.cost > 0) {
      const handle = (user.trim() || "bubbleguest").replace(/^@/, "");
      useBucksLedger.getState().addSpent("x", handle, action.cost);
    }
    publishOverlayEvent({
      room,
      actionId: action.id,
      kind: action.kind,
      label: action.label,
      user: user.trim() || "bubbleguest",
      cost: action.cost,
      payload: {
        side: SIDE_BY_ACTION[action.id],
        ticker,
        emote: EMOTE_BY_ACTION[action.id] ?? emote,
        color: action.id === "mood-wave" ? color : action.accent,
        message: message.trim().slice(0, 72),
        damage: action.id === "whale-storm" ? 30 : action.id === "boss-attack" ? 18 : action.id === "bear-slash" ? 24 : 8,
      },
    });
    setLast(`${action.label} sent. ${compact(next)} BB left.`);
  };

  const earn = (n: number) => saveBalance(balance + n);

  return (
    <div className="min-h-screen overflow-hidden bg-[#080706] text-[#f3efe7]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(217,165,71,0.22),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(22,230,164,0.14),transparent_30%),linear-gradient(180deg,#080706,#120d07)]" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-center gap-3">
          <a href="/" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-bold text-white/75 transition hover:text-white">
            <ArrowLeft size={14} /> Dashboard
          </a>
          <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#d9a547]/35 bg-[#d9a547]/10 px-3 py-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#e8c987]">
            <Radio size={14} /> Room {room.replace(/-/g, " ")}
          </div>
        </header>

        <section className="grid flex-1 items-center gap-6 py-6 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="space-y-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#16e6a4]/30 bg-[#16e6a4]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#16e6a4]">
                <Sparkles size={14} /> Market Bubble Live Layer
              </div>
              <h1 className="max-w-xl text-5xl font-black leading-[0.92] tracking-normal text-white sm:text-6xl">
                Spend Bubble Bucks. Move the overlay.
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-6 text-white/62">
                Scan from the stream, pick a clean effect, and spend Bubble Bucks to trigger controlled on-screen moments.
              </p>
            </div>

            <div className="rounded-2xl border border-[#d9a547]/25 bg-black/35 p-4 shadow-[0_22px_80px_rgba(0,0,0,0.42)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9a8f7e]">Your Balance</div>
                  <div className="mt-1 flex items-center gap-2 text-5xl font-black tabular-nums text-[#d9a547]">
                    <Coins size={34} /> {compact(balance)}
                  </div>
                  <div className="mt-1 text-[12px] font-bold text-white/45">Bubble Bucks</div>
                </div>
                <button onClick={() => earn(250)} className="rounded-xl bg-[#d9a547] px-4 py-3 text-[13px] font-black text-[#14100a] shadow-[0_0_24px_rgba(217,165,71,0.35)] transition-transform hover:brightness-110 active:scale-[0.96]">
                  +250 demo BB
                </button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <label className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Display name</span>
                  <input value={user} onChange={(e) => saveUser(e.target.value)} className="mt-1 w-full bg-transparent text-[15px] font-bold text-white outline-none" />
                </label>
                <label className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Spotlight take</span>
                  <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={72} className="mt-1 w-full bg-transparent text-[15px] font-bold text-white outline-none" />
                </label>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Picker label="Ticker" value={ticker} values={TICKERS} onChange={setTicker} />
                <Picker label="Emote" value={emote} values={EMOTES} onChange={setEmote} />
                <Picker label="Wave" value={color} values={COLORS} onChange={setColor} color />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white/70">
              <BadgeCheck size={18} className="text-[#16e6a4]" /> {last}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {OVERLAY_ACTIONS.map((action, i) => {
              const ok = canAfford(balance, action);
              const isClearAction = action.id === "clear-overlay";
              const disabled = !ok || (isSending && !isClearAction);
              return (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.035 }}
                  onClick={() => fire(action)}
                  disabled={disabled}
                  className="group relative min-h-[132px] overflow-hidden rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-42"
                  style={{ borderColor: ok && (!isSending || isClearAction) ? `${action.accent}66` : "rgba(255,255,255,0.1)", background: ok && (!isSending || isClearAction) ? `linear-gradient(140deg, ${action.accent}18, rgba(255,255,255,0.035))` : "rgba(255,255,255,0.025)" }}
                >
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition group-hover:scale-125" style={{ background: `${action.accent}33` }} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">{action.label}</div>
                      <p className="mt-1 text-[12px] leading-5 text-white/55">{action.description}</p>
                    </div>
                    <div className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-black tabular-nums" style={{ color: action.accent, background: `${action.accent}18`, border: `1px solid ${action.accent}55` }}>
                      {action.cost ? `${action.cost} BB` : "Free"}
                    </div>
                  </div>
                  <div className="relative mt-4 inline-flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.12em]" style={{ color: ok && (!isSending || isClearAction) ? action.accent : "rgba(255,255,255,0.45)" }}>
                    {action.kind === "spotlight" ? <MessageSquareText size={14} /> : <Zap size={14} />}
                    {isSending && !isClearAction ? "Cooling down" : ok ? action.cta : "Need more BB"}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function Picker({ label, value, values, onChange, color = false }: { label: string; value: string; values: string[]; onChange: (v: string) => void; color?: boolean }) {
  return (
    <label className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-black text-white outline-none">
        {values.map((v) => (
          <option key={v} value={v} className="bg-[#080706] text-white">
            {color ? v.toUpperCase() : v}
          </option>
        ))}
      </select>
    </label>
  );
}
