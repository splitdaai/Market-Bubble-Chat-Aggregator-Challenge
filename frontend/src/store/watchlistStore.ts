import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useWalletStore } from "./walletStore";
import { useViewerStore } from "./viewerStore";

export interface WatchItem {
  key: string;               // unique, e.g. "asset:BTC" or "kol:ansem"
  type: "asset" | "trader" | "polytrader" | "portfolio" | "kol" | "market";
  label: string;
  sub?: string;
}

interface WatchState {
  /** items keyed by ownerId (wallet address / x:handle / "local") */
  byOwner: Record<string, WatchItem[]>;
  toggle: (owner: string, item: WatchItem) => void;
  remove: (owner: string, key: string) => void;
  has: (owner: string, key: string) => boolean;
  list: (owner: string) => WatchItem[];
}

export const useWatchlistStore = create<WatchState>()(
  persist(
    (set, get) => ({
      byOwner: {},
      toggle: (owner, item) =>
        set((s) => {
          const cur = s.byOwner[owner] ?? [];
          const exists = cur.some((i) => i.key === item.key);
          return { byOwner: { ...s.byOwner, [owner]: exists ? cur.filter((i) => i.key !== item.key) : [item, ...cur] } };
        }),
      remove: (owner, key) => set((s) => ({ byOwner: { ...s.byOwner, [owner]: (s.byOwner[owner] ?? []).filter((i) => i.key !== key) } })),
      has: (owner, key) => (get().byOwner[owner] ?? []).some((i) => i.key === key),
      list: (owner) => get().byOwner[owner] ?? [],
    }),
    { name: "vibechat-watchlist" },
  ),
);

/** Resolve the current owner id from the connected wallet or X identity. */
export function useOwnerId(): string {
  const address = useWalletStore((s) => s.address);
  const xHandle = useViewerStore((s) => s.xHandle);
  return address ? address.toLowerCase() : xHandle ? `x:${xHandle.toLowerCase()}` : "local";
}
