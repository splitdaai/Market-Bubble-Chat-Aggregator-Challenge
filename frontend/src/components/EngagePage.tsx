import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Clapperboard,
  Coins,
  Eraser,
  Eye,
  Gem,
  Hash,
  MessageSquareText,
  Palette,
  Radio,
  Rocket,
  Smile,
  Sparkles,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { OVERLAY_ACTIONS, canAfford, publishOverlayEvent, roomFromSearch, spendBucks, type OverlayActionDef } from "@/lib/overlayEngagement";
import { compact } from "@/lib/format";
import { useBucksLedger } from "@/store/bucksLedgerStore";

const BALANCE_KEY = "market-bubble-engage-balance";
const USER_KEY = "market-bubble-engage-user";
const DEFAULT_BALANCE = 1200;
const DEFAULT_DISPLAY_NAME = "SplitDaWig";
const DEFAULT_SPOTLIGHT_TAKE = "is Building. 🧱";
const SEND_COOLDOWN_MS = 450;
const TICKERS = ["BTC", "ETH", "SOL", "HYPE", "DOGE", "XRP", "NVDA", "COIN", "MSTR", "POLY"];
const EMOTES = ["🚀", "🐂", "💎", "🔥", "W", "📈", "🟢", "👑", "⚡"];
const COLORS = ["#16e6a4", "#d9a547", "#34d6ff", "#f97316", "#a78bfa", "#ff5c7a"];
const SIDE_BY_ACTION: Record<string, "bull" | "bear"> = {
  "charging-bull": "bull",
  "chart-pump": "bull",
  "bear-slash": "bear",
  "chart-dump": "bear",
};
const EMOTE_BY_ACTION: Record<string, string> = {
  "ansem-emote": "ANSEM",
  "banks-emote": "BANKS",
  "nelk-emote": "NELK",
  "happy-dad-emote": "HAPPY DAD",
  "polymarket-emote": "POLY",
  "wagmi-meme": "WAGMI",
  "ngmi-meme": "NGMI",
  "cope-meme": "COPE",
  "send-it-meme": "SEND IT",
  "diamond-hands-meme": "💎🙌",
  "laser-eyes-meme": "LASER EYES",
  "moon-meme": "MOON",
  "dogecoin-meme": "DOGE",
};
const MOBILE_ACTION_LABELS: Record<string, string> = {
  "charging-bull": "Bull",
  "bear-slash": "Bear",
  "chart-pump": "Pump",
  "chart-dump": "Dump",
  "ticker-boost": "Ticker",
  "ansem-emote": "Ansem",
  "banks-emote": "Banks",
  "nelk-emote": "NELK",
  "happy-dad-emote": "Happy",
  "polymarket-emote": "Poly",
  "emote-burst": "Emotes",
  "wagmi-meme": "WAGMI",
  "ngmi-meme": "NGMI",
  "cope-meme": "COPE",
  "send-it-meme": "SEND",
  "diamond-hands-meme": "💎🙌",
  "laser-eyes-meme": "Laser",
  "moon-meme": "Moon",
  "dogecoin-meme": "DOGE",
  "mood-wave": "Mood",
  "clip-boost": "Clip",
  "soundwave": "Wave",
  "spotlight": "Spot",
  "whale-storm": "Whale",
  "clear-overlay": "Clear",
};
const ACTION_VISUALS: Record<string, { icon?: LucideIcon; image?: string; alt: string; wide?: boolean; text?: string }> = {
  "charging-bull": { image: "/overlay-vfx/charging-bull.png", alt: "Charging bull effect" },
  "bear-slash": { image: "/overlay-vfx/bear-slash.png", alt: "Bear slash effect" },
  "chart-pump": { icon: ArrowUpRight, alt: "Green candle chart pump", text: "UP" },
  "chart-dump": { icon: ArrowDownRight, alt: "Red candle chart dump", text: "DOWN" },
  "ticker-boost": { icon: Hash, alt: "Ticker boost" },
  "ansem-emote": { image: "/overlay-emotes/ansem.png", alt: "Ansem emote" },
  "banks-emote": { image: "/overlay-emotes/banks.png", alt: "Banks emote" },
  "nelk-emote": { image: "/overlay-emotes/nelk.png", alt: "NELK emote", wide: true },
  "happy-dad-emote": { image: "/overlay-emotes/happy-dad.svg", alt: "Happy Dad emote", wide: true },
  "polymarket-emote": { image: "/overlay-emotes/polymarket.svg", alt: "Polymarket emote" },
  "emote-burst": { icon: Smile, alt: "Selected emote burst" },
  "wagmi-meme": { icon: ArrowUpRight, alt: "WAGMI meme burst", text: "WAGMI" },
  "ngmi-meme": { icon: ArrowDownRight, alt: "NGMI meme burst", text: "NGMI" },
  "cope-meme": { icon: Smile, alt: "COPE meme burst", text: "COPE" },
  "send-it-meme": { icon: Zap, alt: "SEND IT meme burst", text: "SEND" },
  "diamond-hands-meme": { icon: Gem, alt: "Diamond hands meme burst", text: "💎🙌" },
  "laser-eyes-meme": { icon: Eye, alt: "Laser eyes meme burst", text: "LASER" },
  "moon-meme": { icon: Rocket, alt: "To the moon meme burst", text: "MOON" },
  "dogecoin-meme": { icon: Coins, alt: "Dogecoin meme burst", text: "DOGE" },
  "mood-wave": { icon: Palette, alt: "Color mood wave" },
  "clip-boost": { icon: Clapperboard, alt: "Clip boost" },
  soundwave: { icon: Volume2, alt: "Soundwave hit" },
  spotlight: { icon: MessageSquareText, alt: "Viewer spotlight" },
  "whale-storm": { icon: Gem, alt: "Whale storm", text: "WHALE" },
  "clear-overlay": { icon: Eraser, alt: "Clear overlay" },
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
    if (raw && !/^bubble\d{4}$/i.test(raw) && raw.toLowerCase() !== "bubbleguest") return raw;
  } catch { /* ignore */ }
  return DEFAULT_DISPLAY_NAME;
}

export function EngagePage() {
  const room = useMemo(() => roomFromSearch(), []);
  const [balance, setBalance] = useState(() => storedNumber(BALANCE_KEY, DEFAULT_BALANCE));
  const [user, setUser] = useState(() => storedUser());
  const [ticker, setTicker] = useState(TICKERS[0]);
  const [emote, setEmote] = useState(EMOTES[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [message, setMessage] = useState(DEFAULT_SPOTLIGHT_TAKE);
  const [last, setLast] = useState<string>("Ready to move the overlay.");
  const [isSending, setIsSending] = useState(false);
  const sendLockedUntil = useRef(0);
  const balanceRef = useRef(balance);
  const releaseTimer = useRef<number | null>(null);

  const saveBalance = (n: number) => {
    balanceRef.current = n;
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
    const now = Date.now();
    const isClearAction = action.id === "clear-overlay";
    if (!isClearAction && now < sendLockedUntil.current) {
      setLast("Easy. The overlay is cooling down for a beat.");
      return;
    }
    const currentBalance = balanceRef.current;
    if (!canAfford(currentBalance, action)) {
      setLast(`Need ${compact(action.cost - currentBalance)} more Bubble Bucks for ${action.label}.`);
      return;
    }
    const published = publishOverlayEvent({
      room,
      actionId: action.id,
      kind: action.kind,
      label: action.label,
      user: user.trim() || DEFAULT_DISPLAY_NAME,
      cost: action.cost,
      payload: {
        side: SIDE_BY_ACTION[action.id],
        ticker,
        emote: EMOTE_BY_ACTION[action.id] ?? emote,
        color: action.id === "mood-wave" ? color : action.accent,
        message: message.trim().slice(0, 72),
      },
    });
    if (!published) {
      if (!isClearAction) lockSend();
      setLast("Overlay is protecting the stream from spam. Try again in a moment.");
      return;
    }
    if (!isClearAction) lockSend();
    const next = spendBucks(currentBalance, action);
    saveBalance(next);
    // Record the spend in the persistent BB ledger so the analytics page tracks
    // lifetime spending per viewer. Engage-page viewers identify by their X
    // handle (the only platform that can route an anonymous QR scan back to a
    // real account here); guest viewers fall back to "@bubbleguest".
    if (action.cost > 0) {
      const handle = (user.trim() || DEFAULT_DISPLAY_NAME).replace(/^@/, "");
      useBucksLedger.getState().addSpent("x", handle, action.cost);
    }
    setLast(`${action.label} sent. ${compact(next)} BB left.`);
  };

  const earn = (n: number) => saveBalance(balanceRef.current + n);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080706] text-[#f3efe7]">
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

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
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
                  title={`${action.label}: ${action.description}`}
                  className="group relative min-h-[92px] overflow-hidden rounded-xl border p-2 text-center transition disabled:cursor-not-allowed disabled:opacity-42 sm:min-h-[132px] sm:rounded-2xl sm:p-4 sm:text-left"
                  style={{ borderColor: ok && (!isSending || isClearAction) ? `${action.accent}66` : "rgba(255,255,255,0.1)", background: ok && (!isSending || isClearAction) ? `linear-gradient(140deg, ${action.accent}18, rgba(255,255,255,0.035))` : "rgba(255,255,255,0.025)" }}
                >
                  <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl transition group-hover:scale-125 sm:-right-8 sm:-top-8 sm:h-24 sm:w-24" style={{ background: `${action.accent}33` }} />
                  <div className="relative flex h-full flex-col items-center justify-between gap-2 sm:block">
                    <div className="flex w-full items-start justify-center gap-1 sm:justify-between sm:gap-3">
                      <div className="flex min-w-0 flex-col items-center gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                        <ActionVisual action={action} emote={emote} color={color} enabled={ok && (!isSending || isClearAction)} />
                        <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight text-white sm:text-lg">
                          <span className="sm:hidden">{MOBILE_ACTION_LABELS[action.id] ?? action.label}</span>
                          <span className="hidden sm:inline">{action.label}</span>
                        </div>
                        <p className="mt-1 hidden text-[12px] leading-5 text-white/55 sm:block">{action.description}</p>
                      </div>
                      </div>
                      <div className="hidden shrink-0 rounded-full px-2.5 py-1 text-[12px] font-black tabular-nums sm:block" style={{ color: action.accent, background: `${action.accent}18`, border: `1px solid ${action.accent}55` }}>
                        {action.cost ? `${action.cost} BB` : "Free"}
                      </div>
                    </div>
                    <div className="relative inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] sm:mt-4 sm:gap-1.5 sm:rounded-none sm:px-0 sm:py-0 sm:text-[12px] sm:tracking-[0.12em]" style={{ color: ok && (!isSending || isClearAction) ? action.accent : "rgba(255,255,255,0.45)", background: `${action.accent}12` }}>
                      {action.kind === "spotlight" ? <MessageSquareText size={13} /> : <Zap size={13} />}
                      <span className="hidden sm:inline">{isSending && !isClearAction ? "Cooling down" : ok ? action.cta : "Need more BB"}</span>
                      <span className="sm:hidden">{isSending && !isClearAction ? "Cool" : ok ? action.cost ? `${action.cost} BB` : "Free" : "More BB"}</span>
                    </div>
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

function ActionVisual({ action, emote, color, enabled }: { action: OverlayActionDef; emote: string; color: string; enabled: boolean }) {
  const visual = ACTION_VISUALS[action.id] ?? { icon: Zap, alt: action.label };
  const Icon = visual.icon;
  const tint = enabled ? action.accent : "rgba(255,255,255,0.42)";
  const dynamicText = action.id === "emote-burst" ? emote : visual.text;

  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border sm:h-12 sm:w-12 sm:rounded-xl"
      style={{
        borderColor: enabled ? `${action.accent}66` : "rgba(255,255,255,0.12)",
        background: action.id === "mood-wave"
          ? `linear-gradient(135deg, ${color}, rgba(255,255,255,0.08))`
          : `linear-gradient(135deg, ${action.accent}22, rgba(255,255,255,0.05))`,
        boxShadow: enabled ? `0 0 20px ${action.accent}22` : "none",
      }}
      aria-label={visual.alt}
    >
      {visual.image ? (
        <img
          src={visual.image}
          alt=""
          draggable={false}
          className={`select-none object-contain ${visual.wide ? "h-6 w-8 sm:h-8 sm:w-11" : "h-8 w-8 sm:h-11 sm:w-11"}`}
        />
      ) : (
        <span className="flex flex-col items-center justify-center leading-none">
          {Icon ? <Icon size={dynamicText ? 15 : 20} className="sm:h-6 sm:w-6" style={{ color: tint }} /> : null}
          {dynamicText ? <span className="mt-0.5 max-w-[42px] truncate text-[7px] font-black tracking-normal sm:text-[8px]" style={{ color: tint }}>{dynamicText}</span> : null}
        </span>
      )}
    </span>
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
