// Wall-embed volume bridge. When this app runs inside an iframe (the Return to
// Memes venue wall), the parent posts { type: "mb:volume", value: 0..1 } and we
// apply it to every media element we own. Until the first message arrives we
// stay at 0 (muted) — that also satisfies browser autoplay policy, so the
// stream video plays the moment the wall loads, silently.
import { useAudioStore } from "@/store/audioStore";

const embedded = typeof window !== "undefined" && window.self !== window.top;
let volume = 0;

function applyAll(): void {
  document.querySelectorAll<HTMLMediaElement>("video, audio").forEach((el) => {
    el.volume = volume;
    el.muted = volume <= 0;
  });
}

if (embedded) {
  // The app's own audio store (vibechat-audio in localStorage, default volume
  // 0.7) is what StreamPreview.tsx reads to drive its <video>. If a user's
  // persisted state has muted=false, StreamPreview would apply an audible
  // volume the instant it mounts — before this bridge's MutationObserver/
  // interval gets a chance to re-mute it. Force the store muted immediately so
  // that first application is always silent while embedded.
  useAudioStore.getState().setMuted(true);
  // zustand persist rehydrates from localStorage asynchronously, which can
  // overwrite the muted flag we just set above after this line runs. Re-assert
  // once rehydration finishes (or immediately, if it already has).
  const persistApi = useAudioStore.persist;
  if (persistApi?.hasHydrated?.()) {
    useAudioStore.getState().setMuted(true);
  } else {
    persistApi?.onFinishHydration?.(() => {
      useAudioStore.getState().setMuted(true);
    });
  }

  window.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as { type?: unknown; value?: unknown } | null;
    if (!d || d.type !== "mb:volume" || typeof d.value !== "number" || !Number.isFinite(d.value)) return;
    volume = Math.min(1, Math.max(0, d.value));
    applyAll();
    // The bridge is the sole source of truth for audibility while embedded —
    // when it raises volume above 0, unmute the store too so StreamPreview's
    // own muted/volume effect (which also drives the <video>) agrees instead
    // of re-muting it on its next render.
    useAudioStore.getState().setMuted(volume <= 0);
  });

  // Media elements mount late (lazy views, tab switches) and the app's own audio
  // code may unmute them. Re-assert on DOM changes (throttled) + a slow interval.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    window.setTimeout(() => {
      queued = false;
      applyAll();
    }, 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(applyAll, 5_000);
  applyAll();
}

export {};
