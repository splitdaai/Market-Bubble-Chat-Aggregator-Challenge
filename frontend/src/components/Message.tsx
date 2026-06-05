import { memo, useState } from "react";
import { motion } from "framer-motion";
import type { ChatMessage, ModerationAction } from "@shared/types";
import { SourceBadge, platformColor } from "./SourceBadge";
import { Shield, Star, Crown, BadgeCheck, Gem, Wallet } from "lucide-react";
import { ModMenu } from "./ModMenu";
import { useUserCardStore } from "@/store/userCardStore";
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
  const color = msg.color ?? platformColor(msg.platform);
  const hasWallet = !!viewerWallet(msg.username, demo);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, x: -10, scale: 0.98 }}
        animate={{ opacity: deleted ? 0.45 : 1, x: 0, scale: 1 }}
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
          <SourceBadge platform={msg.platform} compact />
          {msg.channel && (
            <span className="text-[10px] font-semibold text-muted/80" title={`Watching ${msg.channel}`}>{msg.channel}</span>
          )}
          {msg.badges?.map((b, idx) => (
            <span key={idx} title={b.label} className="inline-grid place-items-center">
              {badgeIcon[b.type]}
            </span>
          ))}
          <button
            className="font-bold hover:underline"
            style={{ color }}
            onClick={() => showUser(msg.username, msg.platform)}
            title="View profile & messages"
          >
            {msg.username}
          </button>
          {hasWallet && (
            <Wallet size={11} className="text-emerald-400" aria-label="Wallet-connected — can receive tips" />
          )}
          <span className="text-[10px] tabular-nums text-muted opacity-60">{fmtTime(msg.timestamp)}</span>
          <span className={`ml-0.5 break-words text-ink/90 ${deleted ? "line-through opacity-60" : ""}`}>
            {msg.message}
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
