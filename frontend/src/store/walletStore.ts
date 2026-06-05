import { create } from "zustand";
import { persist } from "zustand/middleware";
import { connectWallet, getCurrentAccount, getProvider, hasInjectedWallet } from "@/lib/web3";

/**
 * The streamer-operator's own EVM wallet (Banks / Ansem), used to send tips to
 * viewers. Non-custodial: we only keep the public address + chain in memory;
 * signing always happens in the wallet extension.
 */
interface WalletState {
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
  /** Operator toggle: expose the "Tip" action on wallet-connected viewers. */
  tipEnabled: boolean;

  connect: () => Promise<void>;
  disconnect: () => void;
  setTipEnabled: (v: boolean) => void;
  /** Re-attach to an already-authorized wallet on load + watch for changes. */
  hydrate: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      chainId: null,
      connecting: false,
      error: null,
      tipEnabled: true,

      connect: async () => {
        set({ connecting: true, error: null });
        try {
          const { address, chainId } = await connectWallet();
          set({ address, chainId, connecting: false });
        } catch (e) {
          set({ connecting: false, error: e instanceof Error ? e.message : "Wallet connection failed" });
        }
      },

      disconnect: () => set({ address: null, chainId: null, error: null }),

      setTipEnabled: (tipEnabled) => set({ tipEnabled }),

      hydrate: () => {
        if (!hasInjectedWallet()) return;
        getCurrentAccount()
          .then((acct) => {
            if (acct) set({ address: acct.address, chainId: acct.chainId });
          })
          .catch(() => {});
        const p = getProvider();
        p.on?.("accountsChanged", (...args) => {
          const accounts = args[0] as string[];
          set({ address: accounts?.[0] ?? null });
        });
        p.on?.("chainChanged", (...args) => {
          const hex = args[0] as string;
          set({ chainId: parseInt(hex, 16) });
        });
      },
    }),
    { name: "vibechat-wallet", partialize: (s) => ({ tipEnabled: s.tipEnabled }) },
  ),
);
