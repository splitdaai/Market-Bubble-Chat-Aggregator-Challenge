import { useEffect, useMemo, useRef, useState } from "react";
import { useStatsStore } from "@/store/statsStore";
import { useViewerStore } from "@/store/viewerStore";
import { bucksFor, computeRanks } from "@/lib/bucks";
import type { Platform } from "@shared/types";

/**
 * Map of user-key (`platform:username`) → 1-20 rank by lifetime Bubble Bits.
 * Memoized on a 5-second cadence so message renders don't re-sort the full
 * user list on every chat tick.
 */
export function useBucksRanks(): Map<string, number> {
  const listUsers = useStatsStore((s) => s.listUsers);
  const [tick, setTick] = useState(0);
  const timer = useRef<number>(0);

  useEffect(() => {
    timer.current = window.setInterval(() => setTick((t) => t + 1), 5_000);
    return () => window.clearInterval(timer.current);
  }, []);

  return useMemo(() => {
    void tick; // dependency
    const rows = listUsers().map((u) => ({ platform: u.platform, name: u.name, bucks: bucksFor(u) }));
    return computeRanks(rows, 20);
  }, [listUsers, tick]);
}

/**
 * Small numeric pill (#1 … #20) shown next to a username in chat when that
 * viewer is in the top-20 lifetime Bubble Bits earners. Top-3 get gold,
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
      title={`Bubble Bits rank · #${rank}`}
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
