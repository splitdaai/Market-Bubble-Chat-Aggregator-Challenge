import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Account, Platform } from "@shared/types";
import { DEMO_ACCOUNTS, OWNER_ACCOUNTS, isDemoTrio } from "@/lib/accounts";
import { useModeStore } from "@/store/modeStore";

/**
 * Connected accounts + OBS.
 *
 * Multiple accounts per platform are aggregated into one feed. Seeded with demo
 * channels (Ansem, Banks, Market Bubble) so multi-account aggregation is visible
 * out of the box.
 *
 * SECURITY: we never store platform passwords/tokens in the browser. Accounts
 * connect via each platform's official OAuth (tokens live server-side). The OBS
 * password is session-only and used solely to talk to OBS locally.
 */

interface ConnectionsState {
  /** What's shown/aggregated right now (Demo = the show trio, Live = your channels). */
  accounts: Account[];
  /** The LIVE list, remembered across Demo↔Live flips (Demo always resets `accounts` to the trio). */
  liveAccounts: Account[];
  obs: { host: string; port: number };
  // runtime-only (never persisted)
  obsConnected: boolean;
  obsVersion?: string;
  obsError?: string;
  obsBusy: boolean;

  addAccount: (platform: Platform, handle: string, displayName: string) => void;
  removeAccount: (id: string) => void;
  toggleAccount: (id: string) => void;
  /** Replace accounts with the backend-provided (OAuth-authed) list in live mode. */
  setAccounts: (accounts: Account[]) => void;
  setObsConfig: (patch: Partial<{ host: string; port: number }>) => void;
  setObsState: (patch: Partial<Pick<ConnectionsState, "obsConnected" | "obsVersion" | "obsError" | "obsBusy">>) => void;
}

// Every write to `accounts` while in LIVE mode is mirrored into `liveAccounts`,
// so the demo reset (useChatConnection) can never lose the operator's channels.
const mirror = (s: ConnectionsState, accounts: Account[]) =>
  useModeStore.getState().demo || isDemoTrio(accounts) ? { accounts } : { accounts, liveAccounts: accounts };

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set) => ({
      accounts: DEMO_ACCOUNTS,
      liveAccounts: OWNER_ACCOUNTS,
      obs: { host: "127.0.0.1", port: 4455 },
      obsConnected: false,
      obsVersion: undefined,
      obsError: undefined,
      obsBusy: false,

      addAccount: (platform, handle, displayName) =>
        set((s) => {
          const clean = handle.trim().replace(/^@?/, platform === "x" || platform === "youtube" ? "@" : "");
          const id = `${platform}:${clean.replace(/^@/, "").toLowerCase()}`;
          if (s.accounts.some((a) => a.id === id)) return s;
          return mirror(s, [...s.accounts, { id, platform, handle: clean, displayName: displayName.trim() || clean, connected: true }]);
        }),
      removeAccount: (id) => set((s) => mirror(s, s.accounts.filter((a) => a.id !== id))),
      toggleAccount: (id) =>
        set((s) => mirror(s, s.accounts.map((a) => (a.id === id ? { ...a, connected: !a.connected } : a)))),
      setAccounts: (accounts) => set((s) => mirror(s, accounts)),
      setObsConfig: (patch) => set((s) => ({ obs: { ...s.obs, ...patch } })),
      setObsState: (patch) => set(patch),
    }),
    {
      name: "vibechat-connections-v5",
      partialize: (s) => ({ accounts: s.accounts, liveAccounts: s.liveAccounts, obs: s.obs }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ConnectionsState>;
        return { ...current, ...p, liveAccounts: p.liveAccounts?.length ? p.liveAccounts : OWNER_ACCOUNTS };
      },
    },
  ),
);

/** Accounts currently aggregated into the feed. */
export const connectedAccounts = (accounts: Account[]) => accounts.filter((a) => a.connected);
