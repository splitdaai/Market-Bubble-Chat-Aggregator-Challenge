import { Star } from "lucide-react";
import { useWatchlistStore, useOwnerId, type WatchItem } from "@/store/watchlistStore";

/** A star toggle that adds/removes anything to the viewer's watchlist. */
export function WatchStar({ item, size = 14 }: { item: WatchItem; size?: number }) {
  const owner = useOwnerId();
  const active = useWatchlistStore((s) => (s.byOwner[owner] ?? []).some((i) => i.key === item.key));
  const toggle = useWatchlistStore((s) => s.toggle);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(owner, item); }}
      title={active ? "Remove from watchlist" : "Add to watchlist"}
      className={`shrink-0 rounded p-0.5 transition ${active ? "text-gold" : "text-faint hover:text-ink"}`}
    >
      <Star size={size} fill={active ? "currentColor" : "none"} strokeWidth={2} />
    </button>
  );
}
