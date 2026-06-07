import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The signed-in viewer's X identity — used to chat in the unified feed as
 * themselves and to scope their watchlist. (Wallet identity lives in walletStore.)
 */
interface ViewerState {
  xHandle: string | null;
  xName: string | null;
  connectX: (handle: string, name?: string) => void;
  disconnectX: () => void;
}

export const useViewerStore = create<ViewerState>()(
  persist(
    (set) => ({
      xHandle: null,
      xName: null,
      connectX: (handle, name) => {
        const h = handle.trim().replace(/^@/, "");
        if (!h) return;
        set({ xHandle: h, xName: (name || h).trim() });
      },
      disconnectX: () => set({ xHandle: null, xName: null }),
    }),
    { name: "vibechat-viewer" },
  ),
);
