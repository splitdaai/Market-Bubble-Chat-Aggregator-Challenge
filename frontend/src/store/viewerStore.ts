import { create } from "zustand";
import { persist } from "zustand/middleware";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

/**
 * The signed-in viewer's X identity — used to chat in the unified feed as
 * themselves and to scope their watchlist. (Wallet identity lives in walletStore.)
 *
 * `loginWithX()` runs the sanctioned X OAuth ("Login with X") in a popup; the
 * backend returns a signed identity token (`chatToken`) that the chat composer
 * sends with every message so the server can verify the handle (no spoofing).
 * `connectX()` remains as a manual, *unverified* fallback.
 */
interface ViewerState {
  xHandle: string | null;
  xName: string | null;
  xAvatar: string | null;
  /** True only when the handle came from real X OAuth (not manual entry). */
  verified: boolean;
  /** HMAC-signed identity token issued by the backend at Login-with-X. */
  chatToken: string | null;
  /** Show MY Bubble Bucks rank badge (#1–#20) next to my username in chat.
   *  Default ON so top-20 viewers flex automatically; off lets you opt out. */
  showMyBucksBadge: boolean;
  loginWithX: () => void;
  connectX: (handle: string, name?: string) => void;
  disconnectX: () => void;
  setShowMyBucksBadge: (v: boolean) => void;
}

export const useViewerStore = create<ViewerState>()(
  persist(
    (set) => ({
      xHandle: null,
      xName: null,
      xAvatar: null,
      verified: false,
      chatToken: null,
      showMyBucksBadge: true,

      loginWithX: () => {
        const w = 600;
        const h = 720;
        const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
        const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
        const popup = window.open(
          `${BACKEND}/auth/x/start?mode=viewer`,
          "mb-x-login",
          `width=${w},height=${h},left=${left},top=${top}`,
        );
        const onMsg = (e: MessageEvent) => {
          const d = e.data as { type?: string; handle?: string; name?: string; avatar?: string | null; token?: string };
          if (!d || d.type !== "mb-viewer" || !d.token || !d.handle) return;
          window.removeEventListener("message", onMsg);
          set({
            xHandle: String(d.handle).replace(/^@/, ""),
            xName: d.name || d.handle,
            xAvatar: d.avatar ?? null,
            verified: true,
            chatToken: d.token,
          });
          try { popup?.close(); } catch { /* popup may already be closed */ }
        };
        window.addEventListener("message", onMsg);
      },

      connectX: (handle, name) => {
        const h = handle.trim().replace(/^@/, "");
        if (!h) return;
        set({ xHandle: h, xName: (name || h).trim(), xAvatar: null, verified: false, chatToken: null });
      },

      disconnectX: () => set({ xHandle: null, xName: null, xAvatar: null, verified: false, chatToken: null }),

      setShowMyBucksBadge: (v) => set({ showMyBucksBadge: v }),
    }),
    { name: "vibechat-viewer" },
  ),
);
