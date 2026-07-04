import { useModeStore } from "@/store/modeStore";

/** Shared wall mode. The Return to Memes venue embeds this app on a wall
 *  screen. The backend holds one global demo/live flag:
 *  - EMBEDDED (wall) copies FOLLOW it — polled every 10s, applied to the local
 *    mode store so the header badge stays truthful.
 *  - The STANDALONE site keeps each visitor's personal toggle, but every flip
 *    also writes the shared flag — so switching DEMO/LIVE on the site switches
 *    the chat on the venue wall for everyone.
 */
// The flag lives in the venue's control-plane Lambda (persistent, always on) —
// the retired EC2 backend used to hold it; Vercel functions can't keep state.
const WALL_MODE_URL = (import.meta.env.VITE_WALL_MODE_URL as string | undefined) ?? "https://wjyl99umu0.execute-api.eu-west-1.amazonaws.com/public/wall-mode";
const embedded = typeof window !== "undefined" && window.self !== window.top;

let applyingRemote = false;

async function pullWallMode(): Promise<void> {
  try {
    const r = await fetch(WALL_MODE_URL, { signal: AbortSignal.timeout(8_000) });
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
    void fetch(WALL_MODE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ demo: s.demo }),
    }).catch(() => {});
  });
}

export {};
