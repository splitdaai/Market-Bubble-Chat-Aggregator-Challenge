import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Wallet, Clock, MessageSquare, DollarSign, Gift, Ban, TimerReset, Plus, Minus, ShieldOff } from "lucide-react";
import { BubbleScroll } from "./BubbleScroll";
import { useChatStore, userKey } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";
import { useModeStore } from "@/store/modeStore";
import { useWalletStore } from "@/store/walletStore";
import { useUserCardStore } from "@/store/userCardStore";
import { useToastStore } from "@/store/toastStore";
import { useModerationStore, fmtDuration, TIMEOUT_PRESETS } from "@/store/moderationStore";
import { SourceBadge, platformColor, platformLabel } from "./SourceBadge";
import { viewerWallet } from "@/lib/viewerWallets";
import { avatarUrl } from "@/lib/avatar";
import { shortAddr } from "@/lib/web3";
import { moderate } from "@/lib/api";
import { compact } from "@/lib/format";
import { TipModal } from "./TipModal";
import type { Platform } from "@shared/types";

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${date} · ${time}`;
}

/** Avatar — real X PFP via unavatar for X users, else a colored initial. */
function Avatar({ name, platform, color }: { name: string; platform: Platform; color: string }) {
  const url = avatarUrl(name, platform);
  const [err, setErr] = useState(false);
  if (url && !err) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setErr(true)}
        className="h-12 w-12 rounded-full object-cover"
        style={{ border: `2px solid ${color}`, background: "#1a1622" }}
      />
    );
  }
  return (
    <div
      className="grid h-12 w-12 place-items-center rounded-full text-lg font-extrabold text-white"
      style={{ background: `color-mix(in srgb, ${color} 35%, #1a1622)`, border: `2px solid ${color}` }}
    >
      {name.replace(/^@/, "").slice(0, 1).toUpperCase()}
    </div>
  );
}

/**
 * Twitch-style viewer profile: click any username to see their full message
 * history, totals, stacking-timeout moderation and — if they've linked an EVM
 * wallet — a one-tap tip button.
 */
const SYNTH_LINES = [
  "lets go 🚀", "GG", "bullish af", "what's the play here?", "🔥🔥🔥", "first time catching live",
  "W stream", "this is wild", "chat moving fast", "real time zero lag 🫡", "to the moon", "ngmi",
  "based", "clip that", "LFG", "ser when", "hodl", "+EV", "🐂 szn", "respect", "big if true", "🤝",
];

export function UserCard() {
  const open = useUserCardStore((s) => s.open);
  const close = useUserCardStore((s) => s.close);
  const history = useChatStore((s) => s.history);
  const listUsers = useStatsStore((s) => s.listUsers);
  const demo = useModeStore((s) => s.demo);
  const tipEnabled = useWalletStore((s) => s.tipEnabled);
  const push = useToastStore((s) => s.push);

  const timeouts = useModerationStore((s) => s.timeouts);
  const banned = useModerationStore((s) => s.banned);
  const addTimeout = useModerationStore((s) => s.addTimeout);
  const reduceTimeout = useModerationStore((s) => s.reduceTimeout);
  const clearTimeout = useModerationStore((s) => s.clearTimeout);
  const setBanned = useModerationStore((s) => s.setBanned);

  const [tipping, setTipping] = useState(false);
  const [moMode, setMoMode] = useState<"none" | "add" | "reduce">("none");

  // Reset the moderation sub-panel whenever a different viewer's card opens.
  useEffect(() => { setMoMode("none"); setTipping(false); }, [open?.name, open?.platform]);

  // Every message this user has sent this session — aggregated across ALL
  // platforms (same display name on Twitch + Kick + X + YouTube → one list).
  const userMessages = useMemo(() => {
    if (!open) return [];
    const name = open.name.toLowerCase();
    return Object.entries(history)
      .filter(([k]) => k.slice(k.indexOf(":") + 1).toLowerCase() === name)
      .flatMap(([, msgs]) => msgs)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [history, open]);

  const row = useMemo(
    () => (open ? listUsers().find((u) => u.name === open.name && u.platform === open.platform) : undefined),
    [open, listUsers],
  );

  // Messages to show. Real chatters have stored history. Demo users seeded by
  // the warm-start have a message count but no stored history — synthesize that
  // many timestamped lines (deterministic) so the list matches the count.
  const displayMessages = useMemo(() => {
    if (userMessages.length || !open) return userMessages;
    const n = Math.min(row?.count ?? 0, 30);
    if (!n) return [];
    const last = row?.last ?? Date.now();
    let seed = 0;
    for (const ch of open.name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const span = 50 * 60 * 1000; // spread over ~50 min before "last"
    return Array.from({ length: n }, (_, i) => ({
      id: `${open.platform}:${open.name}:${i}`,
      platform: open.platform,
      username: open.name,
      message: SYNTH_LINES[Math.floor(rnd() * SYNTH_LINES.length)],
      timestamp: Math.round(last - (i / n) * span - rnd() * 30000),
    })).sort((a, b) => a.timestamp - b.timestamp);
  }, [userMessages, row, open]);

  if (!open) return null;

  const wallet = viewerWallet(open.name, demo);
  const color = platformColor(open.platform);
  const key = `${open.platform}:${open.name.toLowerCase()}`;
  const activeTimeout = timeouts[key];
  const isBanned = !!banned[key];

  const handleStack = async (seconds: number) => {
    const total = addTimeout(open.platform, open.name, seconds);
    await moderate({ platform: open.platform, username: open.name, action: { kind: "timeout", seconds: total } });
    push({ message: `Timed out ${open.name} · ${fmtDuration(total)} total`, tone: "ok" });
  };
  const handleReduce = async (seconds: number) => {
    const total = reduceTimeout(open.platform, open.name, seconds);
    if (total > 0) {
      await moderate({ platform: open.platform, username: open.name, action: { kind: "timeout", seconds: total } });
      push({ message: `Reduced ${open.name} to ${fmtDuration(total)}`, tone: "ok" });
    } else {
      await moderate({ platform: open.platform, username: open.name, action: { kind: "unban" } });
      push({ message: `Timeout removed for ${open.name}`, tone: "ok" });
      setMoMode("none");
    }
  };
  const handleRemoveTimeout = async () => {
    clearTimeout(open.platform, open.name);
    await moderate({ platform: open.platform, username: open.name, action: { kind: "unban" } });
    push({ message: `Timeout removed for ${open.name}`, tone: "ok" });
    setMoMode("none");
  };
  const handleBanToggle = async () => {
    const next = !isBanned;
    setBanned(open.platform, open.name, next);
    if (next) clearTimeout(open.platform, open.name);
    await moderate({ platform: open.platform, username: open.name, action: { kind: next ? "ban" : "unban" } });
    push({ message: next ? `Banned ${open.name}` : `Unbanned ${open.name}`, tone: next ? "error" : "ok" });
  };

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="vc-glass flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden"
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-white/10 p-4" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${color} 12%, transparent), transparent)` }}>
          <div className="flex items-center gap-3">
            <Avatar name={open.name} platform={open.platform} color={color} />
            <div>
              <div className="text-lg font-extrabold text-ink">{open.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <SourceBadge platform={open.platform} compact />
                <span className="text-[11px] text-muted">{platformLabel(open.platform)}</span>
                {row?.channel && <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold text-ink">{row.channel}</span>}
                {wallet && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300" title="Wallet-connected viewer">
                    <Wallet size={10} /> {shortAddr(wallet)}
                  </span>
                )}
                {isBanned && <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">Banned</span>}
                {!isBanned && activeTimeout && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    <TimerReset size={10} /> {fmtDuration(activeTimeout.seconds)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={close} className="rounded p-1 text-muted transition hover:text-ink"><X size={18} /></button>
        </div>

        {/* stat strip */}
        <div className="grid grid-cols-4 gap-px bg-white/5 text-center">
          <Stat icon={<MessageSquare size={13} />} label="msgs" value={compact(Math.max(userMessages.length, row?.count ?? 0))} />
          <Stat icon={<DollarSign size={13} />} label="tipped" value={`$${compact(row?.donated ?? 0)}`} />
          <Stat icon={<Gift size={13} />} label="subs" value={String(row?.subs ?? 0)} />
          <Stat icon={<Clock size={13} />} label="last" value={row ? fmtTime(row.last) : "—"} />
        </div>

        {/* tip */}
        {wallet && tipEnabled && (
          <div className="border-b border-white/10 p-3">
            <button
              onClick={() => setTipping(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/20 py-2 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30"
            >
              <Wallet size={15} /> Send Tip
            </button>
          </div>
        )}

        {/* moderation */}
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMoMode(moMode === "add" ? "none" : "add")}
              disabled={isBanned}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-bold transition disabled:opacity-40 ${
                moMode === "add" ? "border-amber-400/60 bg-amber-400/15 text-amber-300" : "border-white/12 text-muted hover:border-amber-400/50 hover:text-amber-300"
              }`}
            >
              <TimerReset size={15} /> Timeout
            </button>
            <button
              onClick={handleBanToggle}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-bold transition ${
                isBanned ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/12 text-muted hover:border-red-400/50 hover:text-red-300"
              }`}
            >
              {isBanned ? <><ShieldOff size={15} /> Unban</> : <><Ban size={15} /> Ban</>}
            </button>
          </div>

          {/* add/stack durations */}
          {moMode === "add" && !isBanned && (
            <div className="mt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Add time (clicks stack)</div>
              <div className="grid grid-cols-5 gap-1.5">
                {TIMEOUT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleStack(p.seconds)}
                    className="flex items-center justify-center gap-0.5 rounded-lg border border-white/12 py-1.5 text-xs font-bold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-400/10"
                  >
                    <Plus size={10} />{p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* active timeout: reduce / remove */}
          {activeTimeout && !isBanned && (
            <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
                  <TimerReset size={13} /> Timed out · {fmtDuration(activeTimeout.seconds)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMoMode(moMode === "reduce" ? "none" : "reduce")}
                    className={`rounded-md border px-2 py-1 text-[11px] font-bold transition ${moMode === "reduce" ? "border-accent/60 bg-accent/15 text-accent" : "border-white/12 text-muted hover:text-ink"}`}
                  >
                    Reduce
                  </button>
                  <button
                    onClick={handleRemoveTimeout}
                    className="rounded-md border border-white/12 px-2 py-1 text-[11px] font-bold text-muted transition hover:border-emerald-400/50 hover:text-emerald-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {moMode === "reduce" && (
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {TIMEOUT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => handleReduce(p.seconds)}
                      className="flex items-center justify-center gap-0.5 rounded-lg border border-white/12 py-1.5 text-xs font-bold text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-400/10"
                    >
                      <Minus size={10} />{p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* message history */}
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
            All messages ({displayMessages.length})
          </div>
          {displayMessages.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted opacity-70">No messages from this user yet this session.</div>
          ) : (
            <BubbleScroll className="flex-1">
              <div className="flex flex-col gap-1">
                {[...displayMessages].reverse().map((m) => (
                  <div key={m.id} className="flex items-baseline gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                    <span className="shrink-0"><SourceBadge platform={m.platform} compact /></span>
                    <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted opacity-60">{fmtTime(m.timestamp)}</span>
                    <span className="break-words text-[13px] leading-snug text-ink/90">{m.message}</span>
                  </div>
                ))}
              </div>
            </BubbleScroll>
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
