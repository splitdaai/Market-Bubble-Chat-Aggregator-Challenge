import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExtPlatform } from "@shared/types";
import { EXT_PLATFORMS } from "@/components/SourceBadge";

/**
 * Connection state for streaming platforms + OBS.
 *
 * SECURITY: we never store platform passwords, tokens, or API keys in the
 * browser. Platform accounts connect via each platform's official OAuth (the
 * backend holds tokens server-side). Only non-secret status + the display
 * handle are persisted. The OBS password lives in component state for the
 * session and is used solely to talk to OBS WebSocket on this device.
 */

export interface PlatformConn {
  connected: boolean;
  handle?: string;
}

function blankPlatforms(): Record<ExtPlatform, PlatformConn> {
  return EXT_PLATFORMS.reduce(
    (acc, p) => ((acc[p] = { connected: false }), acc),
    {} as Record<ExtPlatform, PlatformConn>,
  );
}

interface ConnectionsState {
  platforms: Record<ExtPlatform, PlatformConn>;
  obs: { host: string; port: number };
  // runtime-only (never persisted)
  obsConnected: boolean;
  obsVersion?: string;
  obsError?: string;
  obsBusy: boolean;

  connectPlatform: (p: ExtPlatform, handle: string) => void;
  disconnectPlatform: (p: ExtPlatform) => void;
  setObsConfig: (patch: Partial<{ host: string; port: number }>) => void;
  setObsState: (patch: Partial<Pick<ConnectionsState, "obsConnected" | "obsVersion" | "obsError" | "obsBusy">>) => void;
}

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set) => ({
      platforms: blankPlatforms(),
      obs: { host: "127.0.0.1", port: 4455 },
      obsConnected: false,
      obsVersion: undefined,
      obsError: undefined,
      obsBusy: false,

      connectPlatform: (p, handle) =>
        set((s) => ({ platforms: { ...s.platforms, [p]: { connected: true, handle } } })),
      disconnectPlatform: (p) =>
        set((s) => ({ platforms: { ...s.platforms, [p]: { connected: false } } })),
      setObsConfig: (patch) => set((s) => ({ obs: { ...s.obs, ...patch } })),
      setObsState: (patch) => set(patch),
    }),
    {
      name: "vibechat-connections",
      // Persist only non-secret config; OBS connection state is runtime.
      partialize: (s) => ({ platforms: s.platforms, obs: s.obs }),
    },
  ),
);
