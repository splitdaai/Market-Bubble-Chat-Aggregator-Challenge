import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

/** Most recent full episode (EP5) — the default replay shown when nothing is live. */
export const LATEST_EPISODE_BID = "1dxYllbQZELJX";

/**
 * Plays an X broadcast replay (full episode) via the guest HLS proxy — hls.js in
 * Chrome/Firefox, native HLS in Safari. Falls back to a "Watch on X" link.
 */
export function XVodPlayer({ id, autoPlay, onError, className = "aspect-video w-full rounded-xl border border-white/10 bg-black" }: { id: string; autoPlay?: boolean; onError?: () => void; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  const fail = () => { setErr(true); onError?.(); };
  useEffect(() => {
    setErr(false);
    let hls: Hls | null = null;
    let dead = false;
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/x-vod/${id}`);
        if (!r.ok) throw new Error("vod");
        const { master } = await r.json();
        const url = `${BACKEND}${master}`;
        const v = ref.current;
        if (!v || dead) return;
        // Set the muted PROPERTY (React's `muted` attr alone won't satisfy Chrome's
        // autoplay policy) and kick play() once ready — hls.js attaches async.
        v.muted = !!autoPlay;
        const kick = () => { if (autoPlay) { v.muted = true; v.play().catch(() => {}); } };
        v.addEventListener("canplay", kick, { once: true });
        if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = url;
        } else if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true });
          hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) fail(); });
          hls.on(Hls.Events.MANIFEST_PARSED, kick);
          hls.loadSource(url);
          hls.attachMedia(v);
        } else {
          fail();
        }
      } catch { fail(); }
    })();
    return () => { dead = true; hls?.destroy(); };
  }, [id, autoPlay]);

  if (err) {
    return (
      <div className={`grid place-items-center bg-black ${className}`}>
        <a href={`https://x.com/i/broadcasts/${id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-bold text-accent hover:bg-accent/25">▶ Watch full replay on X ↗</a>
      </div>
    );
  }
  return <video ref={ref} controls autoPlay={autoPlay} muted={autoPlay} playsInline className={className} />;
}
