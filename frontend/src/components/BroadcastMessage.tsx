import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Crown, Shield, Star, Gem, BadgeCheck, Wallet } from "lucide-react";
import { useEmoteStore, getEmoteUrl } from "@/lib/emotes";
import { useUserCardStore } from "@/store/userCardStore";
import { useModerationStore } from "@/store/moderationStore";
import { useModeStore } from "@/store/modeStore";
import { viewerWallet } from "@/lib/viewerWallets";
import { platformColor, platformIcon } from "./SourceBadge";
import type { ChatMessage, ModerationAction } from "@shared/types";

/**
 * Broadcast-quality message renderer for the OBS chat source.
 *
 * Tuned for legibility on a stream:
 *   · sub-pixel-precise typography (text-rendering + font-feature-settings)
 *   · text-shadow halo so every message stays readable on busy backgrounds
 *   · disciplined platform-color border + chip (broadcast lower-third feel)
 *   · refined badge row, tabular timestamps, no hover affordances
 *   · cleaner motion: slide-in from the left with a snappy spring, no bounce
 *
 * Intentionally NOT used on the dashboard / dock / simple feeds — those
 * keep the existing dense `<Message>` component. This is for `?broadcast=1`.
 */

const BADGE_ICON: Record<string, React.ReactNode> = {
  moderator: <Shield size={11} strokeWidth={2.4} className="text-emerald-400" />,
  subscriber: <Star size={11} strokeWidth={2.4} className="text-amber-400" />,
  vip: <Gem size={11} strokeWidth={2.4} className="text-pink-400" />,
  broadcaster: <Crown size={11} strokeWidth={2.4} className="text-red-400" />,
  verified: <BadgeCheck size={11} strokeWidth={2.4} className="text-sky-400" />,
  founder: <Crown size={11} strokeWidth={2.4} className="text-amber-300" />,
  og: <Star size={11} strokeWidth={2.4} className="text-lime-400" />,
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

interface Props {
  msg: ChatMessage;
  deleted: boolean;
  onModerate: (action: ModerationAction) => void;
}

function BroadcastMessageInner({ msg, deleted }: Props) {
  const showUser = useUserCardStore((s) => s.show);
  const demo = useModeStore((s) => s.demo);
  const modKey = `${msg.platform}:${msg.username.toLowerCase()}`;
  const modded = useModerationStore((s) => !!s.banned[modKey] || !!s.timeouts[modKey]);
  const struck = deleted || modded;
  const color = msg.color ?? platformColor(msg.platform);
  const hasWallet = !!viewerWallet(msg.username, demo);

  // Inline emote rendering (7TV/BTTV/FFZ/Twitch).
  const emoteVersion = useEmoteStore((s) => s.version);
  const parts = useMemo(() => {
    void emoteVersion;
    const tokens = msg.message.split(/(\s+)/);
    if (!tokens.some((t) => getEmoteUrl(t))) return null;
    return tokens.map((t, i) => {
      const url = getEmoteUrl(t);
      return url ? <img key={i} src={url} alt={t} title={t} loading="lazy" className="-my-0.5 inline-block h-[22px] w-auto align-middle" /> : t;
    });
  }, [msg.message, emoteVersion]);

  const hype = msg.hype;
  const hasEvent = !!msg.event;
  const eventKind = msg.event?.kind; // "tip" | "bits" | "subscription" | "gift"
  const eventAmount = msg.event?.amount;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: struck ? 0.42 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 560, damping: 42, mass: 0.5 }}
      className="vc-bcast-row group relative my-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-[10px] px-2.5 py-[7px]"
      style={{
        // Left accent in platform color — broadcast lower-third feel.
        boxShadow: `inset 3px 0 0 0 ${color}${hype ? "" : "B3"}`,
        background: hype
          ? `linear-gradient(90deg, ${color}1F 0%, ${color}0A 38%, transparent 75%)`
          : hasEvent
          ? `linear-gradient(90deg, rgba(217,165,71,0.18) 0%, rgba(217,165,71,0.06) 50%, transparent 100%)`
          : undefined,
        border: hasEvent ? "1px solid rgba(217,165,71,0.32)" : undefined,
      }}
    >
      {/* Platform chip — sharper, more disciplined than the default SourceBadge */}
      <span
        className="vc-bcast-chip inline-flex shrink-0 items-center justify-center self-center rounded-md"
        style={{
          width: 22,
          height: 22,
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
          color,
          border: `1px solid color-mix(in srgb, ${color} 55%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 10%, transparent), 0 0 6px color-mix(in srgb, ${color} 30%, transparent)`,
        }}
        title={msg.platform}
      >
        {platformIcon(msg.platform)}
      </span>

      {/* Role badges (mod / sub / vip / etc.) — render only the highest-ranking 2 */}
      {msg.badges?.slice(0, 2).map((b, idx) => (
        <span key={idx} title={b.label} className="inline-grid shrink-0 place-items-center self-center">
          {BADGE_ICON[b.type]}
        </span>
      ))}

      <button
        onClick={() => showUser(msg.username, msg.platform)}
        className="vc-bcast-name shrink-0 self-center font-bold tracking-[-0.005em]"
        style={{
          color,
          textShadow: `0 0 18px color-mix(in srgb, ${color} 50%, transparent), 0 1px 0 rgba(0,0,0,0.45)`,
        }}
        title="Open profile"
      >
        {msg.username}
      </button>

      {/* Channel pill — small, only when present */}
      {msg.channel && (
        <span className="vc-bcast-channel inline-flex shrink-0 items-center self-center rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: "rgba(232,201,135,0.85)", background: "rgba(217,165,71,0.08)", border: "1px solid rgba(217,165,71,0.22)" }}>
          {msg.channel}
        </span>
      )}

      {hasWallet && (
        <Wallet size={11} className="shrink-0 self-center text-emerald-400" style={{ filter: "drop-shadow(0 0 6px rgba(52,211,153,0.5))" }} aria-label="Tippable wallet" />
      )}

      {/* Timestamp — tabular, subtle */}
      <span className="vc-bcast-time shrink-0 self-center text-[10px] font-semibold tabular-nums" style={{ color: "rgba(243,239,231,0.42)" }}>
        {fmtTime(msg.timestamp)}
      </span>

      {/* The message itself — flex-basis full so it wraps to its own line
          when the meta row gets crowded (channel chips, tip badges, etc.). */}
      <span
        className={`vc-bcast-text basis-full break-words ${struck ? "line-through opacity-55" : ""}`}
        style={{
          color: "rgba(243,239,231,0.96)",
          textShadow: "0 1px 0 rgba(0,0,0,0.45), 0 0 14px rgba(0,0,0,0.55)",
          paddingLeft: 30, // align under the username (chip 22 + gap 8 ≈ 30)
        }}
      >
        {parts ?? msg.message}
      </span>

      {/* Tip / bits / sub badge — visible only on revenue-bearing messages.
          Pushed to the right of the meta row only (not stealing basis from
          the message which now lives on its own wrapped line). */}
      {hasEvent && (
        <span
          className="ml-auto inline-flex shrink-0 items-center gap-1 self-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]"
          style={{
            order: 100,
            color: "#14100a",
            background: "linear-gradient(180deg, #f4d27a, #d9a547)",
            boxShadow: "0 0 16px rgba(217,165,71,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
          }}
        >
          {eventKind === "donation" || eventKind === "bits"
            ? `$${Math.round(eventAmount ?? 0)}`
            : eventKind === "gift"
            ? `× ${msg.event?.count ?? 1} GIFT`
            : "SUB"}
        </span>
      )}
    </motion.div>
  );
}

export const BroadcastMessage = memo(BroadcastMessageInner);
