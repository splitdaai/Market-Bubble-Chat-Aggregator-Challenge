import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Wallet, Clock, MessageSquare, DollarSign, Gift, Ban, TimerReset } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";
import { useModeStore } from "@/store/modeStore";
import { useWalletStore } from "@/store/walletStore";
import { useUserCardStore } from "@/store/userCardStore";
import { useToastStore } from "@/store/toastStore";
import { SourceBadge, platformColor, platformLabel } from "./SourceBadge";
import { viewerWallet } from "@/lib/viewerWallets";
import { shortAddr } from "@/lib/web3";
import { moderate } from "@/lib/api";
import { compact } from "@/lib/format";
import { TipModal } from "./TipModal";
import type { ModerationAction } from "@shared/types";

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/**
 * Twitch-style viewer profile: click any username to see their full message
 * history, totals, moderation actions and — if they've linked an EVM wallet —
 * a one-tap tip button.
 */
export function UserCard() {
  const open = useUserCardStore((s) => s.open);
  const close = useUserCardStore((s) => s.close);
  const messages = useChatStore((s) => s.messages);
  const listUsers = useStatsStore((s) => s.listUsers);
  const demo = useModeStore((s) => s.demo);
  const tipEnabled = useWalletStore((s) => s.tipEnabled);
  const push = useToastStore((s) => s.push);
  const [tipping, setTipping] = useState(false);

  const userMessages = useMemo(
    () =>
      open
        ? messages.filter((m) => m.username === open.name && m.platform === open.platform).slice(-100)
        : [],
    [messages, open],
  );

  const row = useMemo(
    () => (open ? listUsers().find((u) => u.name === open.name && u.platform === open.platform) : undefined),
    [open, listUsers],
  );

  if (!open) return null;

  const wallet = viewerWallet(open.name, demo);
  const color = platformColor(open.platform);

  const handleMod = async (action: ModerationAction, label: string) => {
    const res = await moderate({ platform: open.platform, username: open.name, action });
    push({ message: res.ok ? `${label} · ${open.name}` : `Failed: ${res.error}`, tone: res.ok ? "ok" : "error" });
  };

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="vc-glass flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden"
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-white/10 p-4" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${color} 12%, transparent), transparent)` }}>
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 place-items-center rounded-full text-lg font-extrabold text-white"
              style={{ background: `color-mix(in srgb, ${color} 35%, #1a1622)`, border: `2px solid ${color}` }}
            >
              {open.name.replace(/^@/, "").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-extrabold text-ink">{open.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <SourceBadge platform={open.platform} compact />
                <span className="text-[11px] text-muted">{platformLabel(open.platform)}</span>
                {wallet && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300" title="Wallet-connected viewer">
                    <Wallet size={10} /> {shortAddr(wallet)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={close} className="rounded p-1 text-muted transition hover:text-ink"><X size={18} /></button>
        </div>

        {/* stat strip */}
        <div className="grid grid-cols-4 gap-px bg-white/5 text-center">
          <Stat icon={<MessageSquare size={13} />} label="msgs" value={compact(row?.count ?? userMessages.length)} />
          <Stat icon={<DollarSign size={13} />} label="tipped" value={`$${compact(row?.donated ?? 0)}`} />
          <Stat icon={<Gift size={13} />} label="subs" value={String(row?.subs ?? 0)} />
          <Stat icon={<Clock size={13} />} label="last" value={row ? fmtTime(row.last) : "—"} />
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 border-b border-white/10 p-3">
          {wallet && tipEnabled ? (
            <button
              onClick={() => setTipping(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/20 py-2 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30"
            >
              <Wallet size={15} /> Send Tip
            </button>
          ) : (
            <div className="flex-1 text-center text-[11px] text-muted opacity-70">
              {wallet ? "Tipping is turned off in Connections" : "Viewer hasn't linked a wallet"}
            </div>
          )}
          <button onClick={() => handleMod({ kind: "timeout", seconds: 600 }, "Timed out 10m")} title="Timeout 10m" className="rounded-lg border border-white/12 p-2 text-muted transition hover:border-amber-400/50 hover:text-amber-300">
            <TimerReset size={16} />
          </button>
          <button onClick={() => handleMod({ kind: "ban" }, "Banned")} title="Ban" className="rounded-lg border border-white/12 p-2 text-muted transition hover:border-red-400/50 hover:text-red-300">
            <Ban size={16} />
          </button>
        </div>

        {/* message history */}
        <div className="vc-scroll min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
            Recent messages ({userMessages.length})
          </div>
          {userMessages.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted opacity-70">No messages in the current session buffer.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {[...userMessages].reverse().map((m) => (
                <div key={m.id} className="flex items-baseline gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                  <span className="shrink-0 text-[10px] tabular-nums text-muted opacity-60">{fmtTime(m.timestamp)}</span>
                  <span className="break-words text-[13px] leading-snug text-ink/90">{m.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {tipping && wallet && (
        <TipModal recipient={{ name: open.name, address: wallet }} onClose={() => setTipping(false)} />
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-black/20 py-2">
      <div className="flex items-center justify-center gap-1 text-muted">{icon}</div>
      <div className="mt-0.5 text-sm font-extrabold text-ink">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
