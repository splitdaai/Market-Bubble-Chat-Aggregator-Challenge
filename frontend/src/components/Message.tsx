import { memo, useMemo, useState } from "react";
import { getEmoteUrl, useEmoteStore } from "@/lib/emotes";
import { motion } from "framer-motion";
import type { ChatMessage, ModerationAction } from "@shared/types";
import { SourceBadge, platformColor } from "./SourceBadge";
import { Shield, Star, Crown, BadgeCheck, Gem, Wallet } from "lucide-react";
import { ModMenu } from "./ModMenu";
import { BucksRankBadge } from "./BucksRankBadge";
import { useUserCardStore } from "@/store/userCardStore";
import { useModerationStore } from "@/store/moderationStore";
import { useModeStore } from "@/store/modeStore";
import { viewerWallet } from "@/lib/viewerWallets";

const badgeIcon: Record<string, React.ReactNode> = {
  moderator: <Shield size={11} className="text-emerald-400" />,
  subscriber: <Star size={11} className="text-amber-400" />,
  vip: <Gem size={11} className="text-pink-400" />,
  broadcaster: <Crown size={11} className="text-red-400" />,
  verified: <BadgeCheck size={11} className="text-sky-400" />,
  founder: <Crown size={11} className="text-amber-300" />,
  og: <Star size={11} className="text-lime-400" />,
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

function MessageInner({ msg, deleted, onModerate }: Props) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const showUser = useUserCardStore((s) => s.show);
  const demo = useModeStore((s) => s.demo);
  // Banned / timed-out viewers (modded from the card) get their messages struck
  // in the unified feed — the local enforcement layer for all platforms.
  const modKey = `${msg.platform}:${msg.username.toLowerCase()}`;
  const modded = useModerationStore((s) => !!s.banned[modKey] || !!s.timeouts[modKey]);
  const struck = deleted || modded;
  const color = msg.color ?? platformColor(msg.platform);
  const hasWallet = !!viewerWallet(msg.username, demo);

  // Render 7TV/BTTV/FFZ/Twitch emotes as inline images. Tokenized once per
  // message (re-runs when new emote sets finish loading).
  const emoteVersion = useEmoteStore((s) => s.version);
  const parts = useMemo(() => {
    void emoteVersion;
    const tokens = msg.message.split(/(\s+)/);
    if (!tokens.some((t) => getEmoteUrl(t))) return null; // fast path: plain text
    return tokens.map((t, i) => {
      const url = getEmoteUrl(t);
      return url ? <img key={i} src={url} alt={t} title={t} loading="lazy" className="-my-1 inline-block h-[24px] w-auto align-middle" /> : t;
    });
  }, [msg.message, emoteVersion]);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, x: -10, scale: 0.98 }}
        animate={{ opacity: struck ? 0.45 : 1, x: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.6 }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuAt({ x: e.clientX, y: e.clientY });
        }}
        className={`group relative rounded-xl px-2.5 py-1.5 transition-colors hover:bg-white/[0.04] ${
          msg.hype ? "vc-hype" : ""
        }`}
        style={
          msg.hype
            ? {
                border: "1px solid color-mix(in srgb, var(--vc-accent) 50%, transparent)",
                boxShadow: "0 0 18px color-mix(in srgb, var(--vc-accent) 35%, transparent)",
                background: "color-mix(in srgb, var(--vc-accent) 8%, transparent)",
              }
            : undefined
        }
      >
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[13px] leading-snug">
          <span className="group/src relative inline-flex">
            <SourceBadge platform={msg.platform} compact />
            {/* hover the icon → which platform + streamer's chat it's from */}
            <span className="pointer-events-none absolute bottom-full left-0 z-40 mb-1 hidden whitespace-nowrap rounded-md border border-white/10 bg-[#0b0b0b] px-1.5 py-0.5 text-[10px] font-semibold shadow-lg group-hover/src:block">
              <span className="capitalize text-muted">{msg.platform}</span>{msg.channel ? <span className="text-ink"> · {msg.channel}</span> : null}
            </span>
          </span>
          {msg.badges?.map((b, idx) => (
            <span key={idx} title={b.label} className="inline-grid place-items-center">
              {badgeIcon[b.type]}
            </span>
          ))}
          <span className="group/u relative inline-flex">
            <button
              className="font-bold hover:underline"
              style={{ color }}
              onClick={() => showUser(msg.username, msg.platform)}
              title={`${msg.platform}${msg.channel ? ` · via ${msg.channel}` : ""} — click for profile`}
            >
              {msg.username}
            </button>
            <BucksRankBadge platform={msg.platform} username={msg.username} />
            {/* hover → where this viewer is coming from (platform + which streamer's chat) */}
            <span className="pointer-events-none absolute bottom-full left-0 z-40 mb-1 hidden whitespace-nowrap rounded-lg border border-white/10 bg-[#0b0b0b] px-2 py-1 text-[10px] leading-tight shadow-xl group-hover/u:block">
              <span className="flex items-center gap-1">
                <SourceBadge platform={msg.platform} compact />
                <span className="font-semibold capitalize text-ink">{msg.platform}</span>
                {msg.channel && <span className="text-muted">· via {msg.channel}</span>}
              </span>
              <span className="mt-0.5 block text-[9px] text-faint">click for full profile</span>
            </span>
          </span>
          {hasWallet && (
            <Wallet size={11} className="text-emerald-400" aria-label="Wallet-connected — can receive tips" />
          )}
          <span className="text-[10px] tabular-nums text-muted opacity-60">{fmtTime(msg.timestamp)}</span>
          {modded && !deleted && (
            <span className="rounded bg-red-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-red-300">modded</span>
          )}
          <span className={`ml-0.5 break-words text-ink/90 ${struck ? "line-through opacity-60" : ""}`}>
            {parts ?? msg.message}
          </span>
        </div>

        {/* hover affordance: quick mod button */}
        {!deleted && (
          <button
            onClick={(e) => setMenuAt({ x: e.clientX, y: e.clientY })}
            className="absolute right-1.5 top-1.5 hidden rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted opacity-0 transition group-hover:inline-flex group-hover:opacity-100 hover:text-accent"
          >
            Mod
          </button>
        )}
      </motion.div>

      {menuAt && (
        <ModMenu
          at={menuAt}
          username={msg.username}
          platform={msg.platform}
          onClose={() => setMenuAt(null)}
          onAction={(a) => {
            onModerate(a);
            setMenuAt(null);
          }}
        />
      )}
    </>
  );
}

export const Message = memo(MessageInner);
