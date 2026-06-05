import { useEffect, useState } from "react";
import { BROADCASTS } from "@/store/broadcastStore";

/**
 * Generates a still preview frame for each broadcast ONCE (one off-screen video
 * seeked to each broadcast's start offset, captured to a canvas → data URL),
 * so the Broadcasts list shows real thumbnails without keeping live <video>
 * elements around that would contend with the main stream-preview player.
 */
const cache: Record<string, string> = {};
let started = false;
const listeners = new Set<() => void>();

function generate() {
  if (started || typeof document === "undefined") return;
  started = true;
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext("2d");
  const queue = [...BROADCASTS];
  let i = 0;

  const seekNext = () => {
    if (i < queue.length) v.currentTime = Math.max(0.1, queue[i].startAt ?? 0.1);
  };

  v.addEventListener("loadeddata", seekNext);
  v.addEventListener("seeked", () => {
    const b = queue[i];
    try {
      ctx?.drawImage(v, 0, 0, canvas.width, canvas.height);
      cache[b.id] = canvas.toDataURL("image/jpeg", 0.62);
      listeners.forEach((l) => l());
    } catch {
      /* decode/taint issue — skip this frame */
    }
    i += 1;
    if (i < queue.length) seekNext();
    else {
      v.removeAttribute("src");
      v.load();
    }
  });

  v.src = BROADCASTS[0].src;
  v.load();
}

export function useBroadcastThumbs(): Record<string, string> {
  const [, force] = useState(0);
  useEffect(() => {
    generate();
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return cache;
}
