import { memo, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getEmoteUrl, useEmoteStore } from "@/lib/emotes";
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
  // Portal-positioned hover tooltip (escapes the feed's overflow clipping so the
  // viewer can always see which platform + stream a chatter is from).
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const showUser = useUserCardStore((s) => s.show);
  const demo = useModeStore((s) => s.demo);
  // Banned / timed-out viewers (modded from the card) get their messages struck
  // in the unified feed — the local enforcement layer for all platforms.
  const modKey = `${msg.platform}:${msg.username.toLowerCase()}`;
  const modded = useModerationStore((s) => !!s.banned[modKey] || !!s.timeouts[modKey]);
  const struck = deleted || modded;
  const color = msg.color ?? platformColor(msg.platform);
  const hasWallet = !!viewerWallet(msg.username, demo);

  // Render resolved platform emotes plus 7TV/BTTV/FFZ/Twitch emotes as inline
  // images. Tokenized once per message (re-runs when new emote sets land).
  const emoteVersion = useEmoteStore((s) => s.version);
  const parts = useMemo(() => {
    void emoteVersion;
    const messageEmotes = new Map((msg.emotes ?? []).map((emote) => [stripColons(emote.code), emote.url]));
    const resolve = (token: string) => messageEmotes.get(token) ?? messageEmotes.get(stripColons(token)) ?? getEmoteUrl(token);
    const inlineCodes = [...messageEmotes.keys()]
      .filter((code) => code.length >= 3)
      .sort((a, b) => b.length - a.length);
    const tokens = msg.message.split(/(\s+)/);
    const rendered: React.ReactNode[] = [];
    let found = false;
    for (const [i, token] of tokens.entries()) {
      const url = resolve(token);
      if (url) {
        found = true;
        rendered.push(emoteImage(`e-${i}`, url, token));
        continue;
      }
      const split = splitKnownEmoteRun(token, inlineCodes);
      if (split) {
        found = true;
        rendered.push(...split.map((part, j) => {
          if (part.kind === "text") return part.text;
          const partUrl = resolve(part.code);
          return partUrl ? emoteImage(`e-${i}-${j}`, partUrl, part.code) : part.code;
        }));
        continue;
      }
      rendered.push(token);
    }
    return found ? rendered : null;
  }, [msg.emotes, msg.message, emoteVersion]);

  return (
    <>
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuAt({ x: e.clientX, y: e.clientY });
        }}
        className={`group relative rounded-xl px-2.5 py-1.5 transition-[background-color,opacity] hover:bg-white/[0.04] ${
          msg.hype ? "vc-hype" : ""
        }`}
        style={
          msg.hype
            ? {
                border: "1px solid color-mix(in srgb, var(--vc-accent) 50%, transparent)",
                boxShadow: "0 0 18px color-mix(in srgb, var(--vc-accent) 35%, transparent)",
                background: "color-mix(in srgb, var(--vc-accent) 8%, transparent)",
                opacity: struck ? 0.45 : 1,
              }
            : { opacity: struck ? 0.45 : 1 }
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
          <span className="relative inline-flex">
            <button
              className="font-bold hover:underline"
              style={{ color }}
              onClick={() => showUser(msg.username, msg.platform)}
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: Math.round(r.left), y: Math.round(r.top) }); }}
              onMouseLeave={() => setTip(null)}
              title={`${msg.platform}${msg.channel ? ` · ${msg.channel}` : ""} — click for profile`}
            >
              {msg.username}
            </button>
            <BucksRankBadge platform={msg.platform} username={msg.username} />
          </span>
          {/* hover → which platform + which stream (Ansem / Banks / Market Bubble)
              this viewer is from. Portal'd to <body> so the feed's overflow
              never clips it. */}
          {tip && createPortal(
            <div
              className="pointer-events-none fixed z-[200] -translate-y-full whitespace-nowrap rounded-lg border border-accent/35 bg-[#0b0b0b] px-2.5 py-1.5 text-[11px] leading-tight shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
              style={{ left: tip.x, top: tip.y - 8 }}
            >
              <span className="flex items-center gap-1.5">
                <SourceBadge platform={msg.platform} compact />
                <span className="font-semibold capitalize text-ink">{msg.platform}</span>
              </span>
              {msg.channel && (
                <span className="mt-1 block">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-faint">stream&nbsp;</span>
                  <span className="font-extrabold text-accent">{msg.channel}</span>
                </span>
              )}
              <span className="mt-0.5 block text-[9px] text-faint">click for full profile</span>
            </div>,
            document.body,
          )}
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
      </div>

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

function stripColons(token: string): string {
  return token.length > 2 && token.startsWith(":") && token.endsWith(":") ? token.slice(1, -1) : token;
}

function emoteImage(key: string, url: string, alt: string) {
  return <img key={key} src={url} alt={alt} title={alt} loading="lazy" className="-my-1 inline-block h-[24px] w-auto align-middle" />;
}

function splitKnownEmoteRun(token: string, codes: string[]): Array<{ kind: "text"; text: string } | { kind: "emote"; code: string }> | null {
  if (!token || codes.length === 0) return null;
  const parts: Array<{ kind: "text"; text: string } | { kind: "emote"; code: string }> = [];
  let text = "";
  let found = false;
  for (let i = 0; i < token.length;) {
    const match = codes.find((code) => token.startsWith(code, i) || token.startsWith(`:${code}:`, i));
    if (!match) {
      text += token[i];
      i += 1;
      continue;
    }
    if (text) {
      parts.push({ kind: "text", text });
      text = "";
    }
    parts.push({ kind: "emote", code: match });
    i += token.startsWith(`:${match}:`, i) ? match.length + 2 : match.length;
    found = true;
  }
  if (text) parts.push({ kind: "text", text });
  return found ? parts : null;
}

export const Message = memo(MessageInner);
