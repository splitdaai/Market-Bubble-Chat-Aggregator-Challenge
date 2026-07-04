// Wall-embed volume bridge. When this app runs inside an iframe (the Return to
// Memes venue wall), the parent posts { type: "mb:volume", value: 0..1 } and we
// apply it to every media element we own. Until the first message arrives we
// stay at 0 (muted) — that also satisfies browser autoplay policy, so the
// stream video plays the moment the wall loads, silently.
const embedded = typeof window !== "undefined" && window.self !== window.top;
let volume = 0;

function applyAll(): void {
  document.querySelectorAll<HTMLMediaElement>("video, audio").forEach((el) => {
    el.volume = volume;
    el.muted = volume <= 0;
  });
}

if (embedded) {
  window.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as { type?: unknown; value?: unknown } | null;
    if (!d || d.type !== "mb:volume" || typeof d.value !== "number" || !Number.isFinite(d.value)) return;
    volume = Math.min(1, Math.max(0, d.value));
    applyAll();
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
