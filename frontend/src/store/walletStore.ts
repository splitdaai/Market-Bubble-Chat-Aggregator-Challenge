import { create } from "zustand";
import { persist } from "zustand/middleware";
import { connectWallet, getCurrentAccount, providerFor } from "@/lib/web3";

/**
 * The streamer-operator's own EVM wallet (Banks / Ansem), used to send tips to
 * viewers. Non-custodial: we only keep the public address + chain in memory;
 * signing always happens in the wallet extension. `rdns` remembers WHICH wallet
 * (MetaMask / Phantom) was picked so reloads reattach to the same one.
 */
interface WalletState {
  address: string | null;
  chainId: number | null;
  /** Display name of the connected wallet, e.g. "MetaMask" / "Phantom". */
  wallet: string | null;
  /** EIP-6963 rdns of the connected wallet (persisted for silent rehydrate). */
  rdns: string | null;
  connecting: boolean;
  error: string | null;
  /** Operator toggle: expose the "Tip" action on wallet-connected viewers. */
  tipEnabled: boolean;

  connect: (rdns?: string) => Promise<void>;
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
      wallet: null,
      rdns: null,
      connecting: false,
      error: null,
      tipEnabled: true,

      connect: async (rdns) => {
        set({ connecting: true, error: null });
        try {
          const r = await connectWallet(rdns);
          set({ address: r.address, chainId: r.chainId, wallet: r.name, rdns: r.rdns, connecting: false });
        } catch (e) {
          set({ connecting: false, error: e instanceof Error ? e.message : "Wallet connection failed" });
        }
      },

      disconnect: () => set({ address: null, chainId: null, wallet: null, rdns: null, error: null }),

      setTipEnabled: (tipEnabled) => set({ tipEnabled }),

      hydrate: () => {
        const rdns = get().rdns ?? undefined;
        getCurrentAccount(rdns)
          .then((acct) => {
            if (acct) set({ address: acct.address, chainId: acct.chainId });
          })
          .catch(() => {});
        const p = providerFor(rdns);
        p?.on?.("accountsChanged", (...args) => {
          const accounts = args[0] as string[];
          set({ address: accounts?.[0] ?? null });
        });
        p?.on?.("chainChanged", (...args) => {
          const hex = args[0] as string;
          set({ chainId: parseInt(hex, 16) });
        });
      },
    }),
    { name: "vibechat-wallet", partialize: (s) => ({ tipEnabled: s.tipEnabled, rdns: s.rdns }) },
  ),
);
