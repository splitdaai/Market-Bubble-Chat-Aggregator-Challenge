import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  OverlayActionKind,
  OverlayEngagementEvent,
  ServerToClientEvents,
} from "@shared/types";
import { BACKEND_URL, getSocket } from "./socket";

export type { OverlayActionKind, OverlayEngagementEvent };

export interface OverlayActionDef {
  id: string;
  kind: OverlayActionKind;
  label: string;
  cost: number;
  description: string;
  cta: string;
  accent: string;
}

export const ENGAGE_ROOM = "market-bubble-live";
const CHANNEL = "market-bubble-overlay-engage";
const STORAGE_KEY = "market-bubble-overlay-engage-event";
type OverlaySocket = Socket<ServerToClientEvents, ClientToServerEvents>;
let overlaySocket: OverlaySocket | null = null;

function overlayTransport(): OverlaySocket | null {
  const existing = getSocket() as OverlaySocket | null;
  if (existing) return existing;
  if (!BACKEND_URL) return null;
  if (!overlaySocket) {
    overlaySocket = io(BACKEND_URL, { transports: ["websocket"] });
  }
  return overlaySocket;
}

export const OVERLAY_ACTIONS: OverlayActionDef[] = [
  { id: "bull-vote", kind: "vote", label: "Bull Vote", cost: 0, description: "Move the crowd meter green.", cta: "Bullish", accent: "#16e6a4" },
  { id: "bear-vote", kind: "vote", label: "Bear Vote", cost: 0, description: "Move the crowd meter red.", cta: "Bearish", accent: "#ff5c7a" },
  { id: "ticker-boost", kind: "ticker", label: "Ticker Boost", cost: 10, description: "Push your ticker onto the live tape.", cta: "Boost ticker", accent: "#34d6ff" },
  { id: "emote-burst", kind: "emote", label: "Emote Burst", cost: 15, description: "Fire a clean emote burst across the panel.", cta: "Burst emotes", accent: "#facc15" },
  { id: "mood-wave", kind: "color", label: "Market Mood Wave", cost: 25, description: "Send a color wash through the overlay.", cta: "Send wave", accent: "#d9a547" },
  { id: "clip-boost", kind: "clip", label: "Clip Boost", cost: 35, description: "Flag this moment for the producer.", cta: "Clip it", accent: "#f97316" },
  { id: "soundwave", kind: "soundwave", label: "Soundwave Hit", cost: 50, description: "Trigger a visual audio-reactive hit.", cta: "Hit wave", accent: "#a78bfa" },
  { id: "spotlight", kind: "spotlight", label: "Viewer Spotlight", cost: 75, description: "Put your one-line take on the overlay.", cta: "Spotlight", accent: "#f8fafc" },
  { id: "boss-attack", kind: "boss", label: "Attack FUD", cost: 125, description: "Damage the FUD boss bar with Bubble Bucks.", cta: "Attack", accent: "#ef4444" },
  { id: "whale-storm", kind: "emote", label: "Whale Storm", cost: 250, description: "A heavier premium emote storm.", cta: "Whale storm", accent: "#67e8f9" },
];

export function actionById(id: string): OverlayActionDef | undefined {
  return OVERLAY_ACTIONS.find((a) => a.id === id);
}

export function canAfford(balance: number, action: Pick<OverlayActionDef, "cost">): boolean {
  return balance >= action.cost;
}

export function spendBucks(balance: number, action: Pick<OverlayActionDef, "cost">): number {
  if (!canAfford(balance, action)) return balance;
  return balance - action.cost;
}

export function roomFromSearch(search = window.location.search): string {
  return new URLSearchParams(search).get("room") || ENGAGE_ROOM;
}

export function engageUrl(room: string, origin = window.location.origin, pathname = window.location.pathname): string {
  return `${origin}${pathname}?engage=1&room=${encodeURIComponent(room)}`;
}

export function qrImageUrl(data: string, size = 132): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=6&data=${encodeURIComponent(data)}`;
}

export function publishOverlayEvent(event: Omit<OverlayEngagementEvent, "id" | "at">): OverlayEngagementEvent {
  const full: OverlayEngagementEvent = {
    ...event,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    at: Date.now(),
  };

  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(full);
    channel.close();
  } catch { /* BroadcastChannel is best-effort. */ }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch { /* storage can be blocked in private contexts. */ }

  window.dispatchEvent(new CustomEvent(STORAGE_KEY, { detail: full }));

  try {
    overlayTransport()?.emit("overlay:action", full);
  } catch { /* hosted relay is best-effort; local fallback already fired. */ }

  return full;
}

export function subscribeOverlayEvents(room: string, cb: (event: OverlayEngagementEvent) => void): () => void {
  const seen = new Set<string>();
  const handle = (event: OverlayEngagementEvent) => {
    if (!event?.id || seen.has(event.id)) return;
    if (event.room !== room) return;
    seen.add(event.id);
    window.setTimeout(() => seen.delete(event.id), 60_000);
    cb(event);
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (ev) => handle(ev.data as OverlayEngagementEvent);
  } catch { /* ignore */ }

  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_KEY || !ev.newValue) return;
    try { handle(JSON.parse(ev.newValue) as OverlayEngagementEvent); } catch { /* ignore */ }
  };
  const onCustom = (ev: Event) => handle((ev as CustomEvent<OverlayEngagementEvent>).detail);
  const socket = overlayTransport();
  const onRemote = (event: OverlayEngagementEvent) => handle(event);

  window.addEventListener("storage", onStorage);
  window.addEventListener(STORAGE_KEY, onCustom);
  try {
    socket?.emit("overlay:join", room);
    socket?.on("overlay:action", onRemote);
  } catch { /* ignore */ }

  return () => {
    channel?.close();
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORAGE_KEY, onCustom);
    socket?.off("overlay:action", onRemote);
  };
}
