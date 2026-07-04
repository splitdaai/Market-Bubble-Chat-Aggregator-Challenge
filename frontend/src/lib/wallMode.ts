import { useModeStore } from "@/store/modeStore";

/** Shared wall mode. The Return to Memes venue embeds this app on a wall
 *  screen. The backend holds one global demo/live flag:
 *  - EMBEDDED (wall) copies FOLLOW it — polled every 10s, applied to the local
 *    mode store so the header badge stays truthful.
 *  - The STANDALONE site keeps each visitor's personal toggle, but every flip
 *    also writes the shared flag — so switching DEMO/LIVE on the site switches
 *    the chat on the venue wall for everyone.
 */
const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";
const embedded = typeof window !== "undefined" && window.self !== window.top;

let applyingRemote = false;

async function pullWallMode(): Promise<void> {
  try {
    const r = await fetch(`${BACKEND}/api/wall-mode`, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return;
    const j = (await r.json()) as { demo?: unknown };
    if (typeof j.demo !== "boolean") return;
    if (useModeStore.getState().demo !== j.demo) {
      applyingRemote = true;
      useModeStore.getState().setDemo(j.demo);
      applyingRemote = false;
    }
  } catch {
    /* backend unreachable — keep current mode */
  }
}

if (embedded) {
  void pullWallMode();
  window.setInterval(() => void pullWallMode(), 10_000);
} else if (typeof window !== "undefined") {
  // Publish the visitor's toggle to the shared flag (fire-and-forget).
  let last = useModeStore.getState().demo;
  useModeStore.subscribe((s) => {
    if (s.demo === last || applyingRemote) return;
    last = s.demo;
    void fetch(`${BACKEND}/api/wall-mode`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ demo: s.demo }),
    }).catch(() => {});
  });
}

export {};
