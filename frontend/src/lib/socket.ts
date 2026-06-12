import { io, type Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ChatMessage,
  ConnectionStatus,
} from "@shared/types";
import { startMockStream } from "./mockData";

/**
 * Thin transport layer.
 *
 * If `VITE_BACKEND_URL` is set we connect to the real Socket.io server.
 * Otherwise we fall back to the local mock firehose so the UI is fully
 * demoable with zero infrastructure. Either way the rest of the app just
 * subscribes to `onMessage` / `onStatus` and never knows the difference.
 */

type Sock = Socket<ServerToClientEvents, ClientToServerEvents>;

// Connect to the real Socket.io server. Defaults to the production backend so a
// missing build-time env never silently drops the app to the mock firehose;
// pass VITE_BACKEND_URL="" explicitly to force demo mode.
export const RAW_BACKEND = import.meta.env.VITE_BACKEND_URL as string | undefined;
export const BACKEND_URL = RAW_BACKEND === undefined ? "https://3-213-104-77.nip.io" : RAW_BACKEND || undefined;

let socket: Sock | null = null;
let stopMock: (() => void) | null = null;

const MOCK_STATUS: ConnectionStatus[] = [
  { platform: "twitch", connected: true, channel: "#demo", latencyMs: 42 },
  { platform: "kick", connected: true, channel: "demo", latencyMs: 61 },
  { platform: "x", connected: true, channel: "stream", latencyMs: 88 },
  { platform: "youtube", connected: true, channel: "live", latencyMs: 73 },
];

export interface Transport {
  onMessage(cb: (m: ChatMessage) => void): void;
  onStatus(cb: (s: ConnectionStatus[]) => void): void;
  moderate: Sock["emit"] extends never ? never : (...args: unknown[]) => void;
  isMock: boolean;
  disconnect(): void;
}

export function connect(
  handlers: {
    onMessage: (m: ChatMessage) => void;
    onStatus: (s: ConnectionStatus[]) => void;
  },
  demo: boolean,
): { isMock: boolean; disconnect: () => void; raw: Sock | null } {
  socket = null;
  stopMock = null;

  if (!demo) {
    // --- LIVE: take everything from the real backend (empty if none configured) ---
    if (BACKEND_URL) {
      socket = io(BACKEND_URL, { transports: ["websocket"] });
      socket.on("message", handlers.onMessage);
      socket.on("status", handlers.onStatus);
      return { isMock: false, disconnect: () => socket?.disconnect(), raw: socket };
    }
    // No backend wired — live but idle (no fake data).
    handlers.onStatus([]);
    return { isMock: false, disconnect: () => {}, raw: null };
  }

  // --- DEMO: mock firehose ---
  handlers.onStatus(MOCK_STATUS);
  stopMock = startMockStream(handlers.onMessage);
  return { isMock: true, disconnect: () => stopMock?.(), raw: null };
}

export function getSocket(): Sock | null {
  return socket;
}

/**
 * Send a verified viewer's message into the shared unified chat. Returns true if
 * it went out over a live backend socket; false if there's no socket (demo mode
 * / no backend), so the caller can fall back to a local-only message.
 */
export function sendChat(req: { token: string; text: string }): boolean {
  if (socket && socket.connected) {
    socket.emit("chat", req);
    return true;
  }
  return false;
}
