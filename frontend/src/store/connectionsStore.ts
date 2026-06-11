import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Account, Platform } from "@shared/types";
import { DEMO_ACCOUNTS } from "@/lib/accounts";

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
  accounts: Account[];
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

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set) => ({
      accounts: DEMO_ACCOUNTS,
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
          return {
            accounts: [...s.accounts, { id, platform, handle: clean, displayName: displayName.trim() || clean, connected: true }],
          };
        }),
      removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),
      toggleAccount: (id) =>
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, connected: !a.connected } : a)) })),
      setAccounts: (accounts) => set({ accounts }),
      setObsConfig: (patch) => set((s) => ({ obs: { ...s.obs, ...patch } })),
      setObsState: (patch) => set(patch),
    }),
    {
      name: "vibechat-connections-v5",
      partialize: (s) => ({ accounts: s.accounts, obs: s.obs }),
    },
  ),
);

/** Accounts currently aggregated into the feed. */
export const connectedAccounts = (accounts: Account[]) => accounts.filter((a) => a.connected);
