import { useSyncExternalStore } from "react";
import { useStatsStore } from "@/store/statsStore";
import { useViewerStore } from "@/store/viewerStore";
import { bucksFor, computeRanks } from "@/lib/bucks";
import type { Platform } from "@shared/types";

/* -------------------------------------------------------------------------- */
/* Shared rank singleton.                                                       */
/*                                                                              */
/* Chat can show dozens of messages at once, each with a rank badge. Computing  */
/* the rank map (a sort over hundreds of users) PER BADGE on its own interval   */
/* was a real perf hit. Instead one module-level computation runs on a single   */
/* 5s interval — but only while at least one badge is mounted — and every badge */
/* reads the same Map via useSyncExternalStore.                                 */
/* -------------------------------------------------------------------------- */

const EMPTY_RANKS = new Map<string, number>();
let currentRanks = EMPTY_RANKS;
const listeners = new Set<() => void>();
let interval: number | null = null;

function recompute() {
  const users = useStatsStore.getState().listUsers();
  const rows = users.map((u) => ({ platform: u.platform, name: u.name, bucks: bucksFor(u) }));
  currentRanks = computeRanks(rows, 20);
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (interval === null) {
    recompute(); // seed immediately for the first subscriber
    interval = window.setInterval(recompute, 5_000);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && interval !== null) {
      window.clearInterval(interval);
      interval = null;
    }
  };
}

/** Map of user-key (`platform:username`) → 1-20 rank by lifetime Bubble Bucks. */
export function useBucksRanks(): Map<string, number> {
  return useSyncExternalStore(subscribe, () => currentRanks);
}

/**
 * Small numeric pill (#1 … #20) shown next to a username in chat when that
 * viewer is in the top-20 lifetime Bubble Bucks earners. Top-3 get gold,
 * silver, and bronze treatments; 4-20 get a uniform gold-bordered chip.
 */
export function BucksRankBadge({
  platform,
  username,
  rank: rankProp,
}: {
  platform: Platform;
  username: string;
  /** Pre-computed rank (avoids subscribing inside long-running lists). */
  rank?: number;
}) {
  const ranks = useBucksRanks();
  const showMy = useViewerStore((s) => s.showMyBucksBadge);
  const myHandle = useViewerStore((s) => s.xHandle);
  const isMine =
    !!myHandle &&
    username.replace(/^@/, "").toLowerCase() === myHandle.toLowerCase();

  // Respect the viewer's own opt-out for THEIR own badge only.
  if (isMine && !showMy) return null;

  const rank = rankProp ?? ranks.get(`${platform}:${username.toLowerCase()}`);
  if (!rank || rank > 20) return null;

  const top3 = rank === 1 ? { fg: "#14100a", bg: "linear-gradient(180deg, #f4d27a, #d9a547)", glow: "rgba(217,165,71,0.55)" }
    : rank === 2 ? { fg: "#14100a", bg: "linear-gradient(180deg, #e5e5e5, #b9bcc2)", glow: "rgba(200,200,210,0.45)" }
    : rank === 3 ? { fg: "#14100a", bg: "linear-gradient(180deg, #e9a777, #b97232)", glow: "rgba(185,114,50,0.45)" }
    : null;

  return (
    <span
      title={`Bubble Bucks rank · #${rank}`}
      className="ml-0.5 inline-flex shrink-0 items-center self-center rounded-full font-black tabular-nums"
      style={
        top3
          ? {
              padding: "1px 5px",
              fontSize: 9,
              letterSpacing: 0,
              color: top3.fg,
              background: top3.bg,
              boxShadow: `0 0 10px ${top3.glow}, inset 0 1px 0 rgba(255,255,255,0.45)`,
              border: "1px solid rgba(255,255,255,0.18)",
            }
          : {
              padding: "1px 5px",
              fontSize: 9,
              letterSpacing: 0,
              color: "#e8c987",
              background: "rgba(217,165,71,0.12)",
              border: "1px solid rgba(217,165,71,0.45)",
              boxShadow: "0 0 8px rgba(217,165,71,0.18)",
            }
      }
    >
      #{rank}
    </span>
  );
}
