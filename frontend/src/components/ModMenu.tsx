import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import type { ModerationAction, ExtPlatform } from "@shared/types";
import { Trash2, Clock, Ban, ShieldCheck, Gauge } from "lucide-react";
import { SourceBadge } from "./SourceBadge";

/**
 * Context menu for cross-platform moderation. Works off ANY message or user
 * regardless of source — the action is dispatched and the backend proxies it to
 * the right platform API. Pass `hideDelete` when there's no message to delete
 * (e.g. acting on a name from the user list).
 */

interface Props {
  at: { x: number; y: number };
  username: string;
  platform: ExtPlatform;
  onAction: (a: ModerationAction) => void;
  onClose: () => void;
  hideDelete?: boolean;
}

const TIMEOUTS = [
  { label: "1 min", seconds: 60 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
];

export function ModMenu({ at, username, platform, onAction, onClose, hideDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Keep the menu on-screen.
  const x = Math.min(at.x, window.innerWidth - 230);
  const y = Math.min(at.y, window.innerHeight - 300);

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      className="vc-glass fixed z-[200] w-56 overflow-hidden p-1.5 text-sm"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <SourceBadge platform={platform} compact />
        <span className="truncate font-semibold text-ink">{username}</span>
      </div>
      <div className="my-1 h-px bg-white/10" />

      {!hideDelete && (
        <MenuItem icon={<Trash2 size={15} />} label="Delete message" onClick={() => onAction({ kind: "delete" })} />
      )}

      <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Timeout
      </div>
      <div className="flex gap-1 px-1.5 pb-1">
        {TIMEOUTS.map((t) => (
          <button
            key={t.seconds}
            onClick={() => onAction({ kind: "timeout", seconds: t.seconds })}
            className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="my-1 h-px bg-white/10" />
      <MenuItem icon={<Ban size={15} className="text-red-400" />} label="Ban user" danger onClick={() => onAction({ kind: "ban" })} />
      <MenuItem icon={<ShieldCheck size={15} className="text-emerald-400" />} label="Unban user" onClick={() => onAction({ kind: "unban" })} />
      <MenuItem icon={<Gauge size={15} />} label="Slow mode (30s)" onClick={() => onAction({ kind: "slow", seconds: 30 })} />
    </motion.div>,
    document.body,
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition hover:bg-white/[0.06] ${
        danger ? "text-red-300 hover:text-red-200" : "text-ink"
      }`}
    >
      <Clock className="hidden" />
      {icon}
      {label}
    </button>
  );
}
