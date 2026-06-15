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

const CLIENT_ROOM_WINDOW_MS = 10_000;
const CLIENT_ROOM_LIMIT = 12;
const HERO_ACTION_IDS = new Set(["charging-bull", "bear-slash", "chart-pump", "chart-dump"]);
const CLIENT_KIND_COOLDOWNS: Partial<Record<OverlayActionKind, number>> = {
  clear: 350,
  clip: 800,
  color: 650,
  emote: 420,
  soundwave: 700,
  spotlight: 900,
  ticker: 140,
};

const clientRoomRate = new Map<string, number[]>();
const clientActionLast = new Map<string, number>();

function overlayTransport(): OverlaySocket | null {
  const existing = getSocket() as OverlaySocket | null;
  if (existing) return existing;
  if (!BACKEND_URL) return null;
  if (!overlaySocket) {
    overlaySocket = io(BACKEND_URL, { transports: ["websocket"] });
  }
  return overlaySocket;
}

/** True when the overlay relay socket is live — in which case the server's
 *  aggregated `crowd-*-pressure` event is the single source of vote counts, so
 *  the local echo must NOT be counted again (avoids double-counting the meter). */
export function overlayRelayConnected(): boolean {
  return !!(getSocket() as OverlaySocket | null)?.connected || !!overlaySocket?.connected;
}

export const OVERLAY_ACTIONS: OverlayActionDef[] = [
  { id: "charging-bull", kind: "vote", label: "Charging Bull", cost: 350, description: "Send a hyper-real bull charging across the source.", cta: "Release bull", accent: "#16e6a4" },
  { id: "bear-slash", kind: "vote", label: "Bear Slash", cost: 350, description: "Rip the screen with a hyper-real bear claw attack.", cta: "Slash screen", accent: "#ff5c7a" },
  { id: "chart-pump", kind: "vote", label: "Green Candle", cost: 300, description: "Launch a giant green candle through the chart.", cta: "Pump chart", accent: "#16e6a4" },
  { id: "chart-dump", kind: "vote", label: "Red Candle", cost: 300, description: "Send a giant red candle crashing down.", cta: "Dump chart", accent: "#ff3f5f" },
  { id: "ticker-boost", kind: "ticker", label: "Ticker Boost", cost: 10, description: "Push your ticker onto the live tape.", cta: "Boost ticker", accent: "#34d6ff" },
  { id: "ansem-emote", kind: "emote", label: "Ansem Spam", cost: 0, description: "Pop custom Ansem emotes across the overlay.", cta: "Spam Ansem", accent: "#f59e0b" },
  { id: "banks-emote", kind: "emote", label: "Banks Spam", cost: 0, description: "Pop custom Banks emotes across the overlay.", cta: "Spam Banks", accent: "#38bdf8" },
  { id: "nelk-emote", kind: "emote", label: "NELK Spam", cost: 0, description: "Pop NELK boys emotes across the overlay.", cta: "Spam NELK", accent: "#f8fafc" },
  { id: "happy-dad-emote", kind: "emote", label: "Happy Dad Spam", cost: 0, description: "Pop Happy Dad emotes across the overlay.", cta: "Spam Happy Dad", accent: "#facc15" },
  { id: "polymarket-emote", kind: "emote", label: "Polymarket Spam", cost: 0, description: "Pop prediction-market emotes across the overlay.", cta: "Spam Poly", accent: "#34d6ff" },
  { id: "emote-burst", kind: "emote", label: "Emote Burst", cost: 15, description: "Fire a clean emote burst across the panel.", cta: "Burst emotes", accent: "#facc15" },
  { id: "wagmi-meme", kind: "emote", label: "WAGMI", cost: 0, description: "Flood the overlay with WAGMI energy.", cta: "Send WAGMI", accent: "#16e6a4" },
  { id: "ngmi-meme", kind: "emote", label: "NGMI", cost: 0, description: "Drop a bearish NGMI meme burst.", cta: "Send NGMI", accent: "#ff5c7a" },
  { id: "cope-meme", kind: "emote", label: "COPE", cost: 0, description: "Send a clean COPE meme burst.", cta: "Send COPE", accent: "#a78bfa" },
  { id: "send-it-meme", kind: "emote", label: "SEND IT", cost: 5, description: "Push a SEND IT meme wave across the source.", cta: "Send it", accent: "#f97316" },
  { id: "diamond-hands-meme", kind: "emote", label: "Diamond Hands", cost: 10, description: "Rain diamond-hands energy over the overlay.", cta: "Diamond hands", accent: "#34d6ff" },
  { id: "laser-eyes-meme", kind: "emote", label: "Laser Eyes", cost: 10, description: "Flash laser-eyes conviction on stream.", cta: "Laser eyes", accent: "#ef4444" },
  { id: "moon-meme", kind: "emote", label: "To The Moon", cost: 15, description: "Launch a moon-mission meme burst.", cta: "Moon it", accent: "#facc15" },
  { id: "dogecoin-meme", kind: "emote", label: "Dogecoin", cost: 15, description: "Send DOGE energy across the stream.", cta: "Send DOGE", accent: "#d9a547" },
  { id: "mood-wave", kind: "color", label: "Market Mood Wave", cost: 25, description: "Send a color wash through the overlay.", cta: "Send wave", accent: "#d9a547" },
  { id: "clip-boost", kind: "clip", label: "Clip Boost", cost: 35, description: "Flag this moment for the producer.", cta: "Clip it", accent: "#f97316" },
  { id: "soundwave", kind: "soundwave", label: "Soundwave Hit", cost: 50, description: "Trigger a visual audio-reactive hit.", cta: "Hit wave", accent: "#a78bfa" },
  { id: "spotlight", kind: "spotlight", label: "Viewer Spotlight", cost: 75, description: "Put your one-line take on the overlay.", cta: "Spotlight", accent: "#f8fafc" },
  { id: "whale-storm", kind: "emote", label: "Whale Storm", cost: 250, description: "A heavier premium emote storm.", cta: "Whale storm", accent: "#67e8f9" },
  { id: "clear-overlay", kind: "clear", label: "Clear Overlay", cost: 0, description: "Testing control: instantly remove active overlay effects.", cta: "Clear now", accent: "#e5e7eb" },
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

function clientActionKey(event: Pick<OverlayEngagementEvent, "room" | "actionId" | "kind">): string {
  const isHero = HERO_ACTION_IDS.has(event.actionId);
  return `${event.room}:${isHero ? "hero" : event.kind}:${isHero ? "visual" : event.actionId}`;
}

function clientCooldownMs(event: Pick<OverlayEngagementEvent, "actionId" | "kind">): number {
  return HERO_ACTION_IDS.has(event.actionId) ? 2400 : CLIENT_KIND_COOLDOWNS[event.kind] ?? 250;
}

export function resetOverlayPublishGate(): void {
  clientRoomRate.clear();
  clientActionLast.clear();
}

export function canPublishOverlayEvent(event: Pick<OverlayEngagementEvent, "room" | "actionId" | "kind">, now = Date.now()): boolean {
  const hist = (clientRoomRate.get(event.room) ?? []).filter((t) => now - t < CLIENT_ROOM_WINDOW_MS);
  if (hist.length >= CLIENT_ROOM_LIMIT) {
    clientRoomRate.set(event.room, hist);
    return false;
  }

  const key = clientActionKey(event);
  const last = clientActionLast.get(key) ?? 0;
  if (now - last < clientCooldownMs(event)) {
    clientRoomRate.set(event.room, hist);
    return false;
  }

  hist.push(now);
  clientRoomRate.set(event.room, hist);
  clientActionLast.set(key, now);
  return true;
}

export function publishOverlayEvent(event: Omit<OverlayEngagementEvent, "id" | "at">): OverlayEngagementEvent | null {
  const full: OverlayEngagementEvent = {
    ...event,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    at: Date.now(),
  };

  if (!canPublishOverlayEvent(full, full.at)) return null;

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
