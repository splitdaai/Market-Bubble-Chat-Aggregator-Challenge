import { useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";
import { LATEST_EPISODE_BID, EPISODE_SLATE_SKIP } from "@/lib/broadcastConstants";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";
export { LATEST_EPISODE_BID, EPISODE_SLATE_SKIP };

/**
 * Plays an X broadcast replay (full episode) via the guest HLS proxy — hls.js in
 * Chrome/Firefox, native HLS in Safari. Falls back to a "Watch on X" link.
 */
export function XVodPlayer({ id, autoPlay, startAt, onError, controls = true, className = "aspect-video w-full rounded-xl border border-white/10 bg-black" }: { id: string; autoPlay?: boolean; startAt?: number; onError?: () => void; controls?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  const fail = () => { setErr(true); onError?.(); };
  useEffect(() => {
    setErr(false);
    let hls: HlsType | null = null;
    let dead = false;
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/x-vod/${id}`);
        if (!r.ok) throw new Error("vod");
        const { master } = await r.json();
        const url = `${BACKEND}${master}`;
        const v = ref.current;
        if (!v || dead) return;
        // Skip X's "recorded live" intro slate once the duration is known, so the
        // replay opens on the hosts instead of the disclaimer card. Guarded so a
        // short clip (or an unknown duration) never seeks into a black frame.
        const seekPastSlate = () => {
          if (!startAt) return;
          if (Number.isFinite(v.duration) && v.duration > startAt + 3 && v.currentTime < startAt) {
            try { v.currentTime = startAt; } catch { /* ignore */ }
          }
        };
        v.addEventListener("loadedmetadata", seekPastSlate, { once: true });
        // Set the muted PROPERTY (React's `muted` attr alone won't satisfy Chrome's
        // autoplay policy) and kick play() once ready — hls.js attaches async.
        v.muted = !!autoPlay;
        const kick = () => { seekPastSlate(); if (autoPlay) { v.muted = true; v.play().catch(() => {}); } };
        v.addEventListener("canplay", kick, { once: true });
        if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = url;
        } else {
          const { default: Hls } = await import("hls.js");
          if (!Hls.isSupported()) {
            fail();
            return;
          }
          hls = new Hls({ enableWorker: true });
          hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) fail(); });
          hls.on(Hls.Events.MANIFEST_PARSED, kick);
          hls.loadSource(url);
          hls.attachMedia(v);
        }
      } catch { fail(); }
    })();
    return () => { dead = true; hls?.destroy(); };
  }, [id, autoPlay, startAt]);

  if (err) {
    return (
      <div className={`grid place-items-center bg-black ${className}`}>
        <a href={`https://x.com/i/broadcasts/${id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-bold text-accent hover:bg-accent/25">▶ Watch full replay on X ↗</a>
      </div>
    );
  }
  return <video ref={ref} controls={controls} autoPlay={autoPlay} muted={autoPlay} playsInline className={className} />;
}
