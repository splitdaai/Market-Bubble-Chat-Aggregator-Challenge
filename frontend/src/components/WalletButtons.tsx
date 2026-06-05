import { useEffect, useState } from "react";
import { Wallet, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { discoverWallets, type WalletOption } from "@/lib/web3";

/**
 * Wallet picker. Lists every EVM wallet the browser exposes (MetaMask, Phantom,
 * …) via EIP-6963 so the operator chooses which one to connect — no guessing at
 * `window.ethereum` when several are installed. Shows install links when none
 * are found.
 */
export function WalletButtons({ onConnected }: { onConnected?: () => void }) {
  const connect = useWalletStore((s) => s.connect);
  const connecting = useWalletStore((s) => s.connecting);
  const error = useWalletStore((s) => s.error);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  // Wallets can inject slightly after first paint — re-scan a couple of times.
  useEffect(() => {
    const scan = () => setWallets(discoverWallets());
    scan();
    const t1 = window.setTimeout(scan, 300);
    const t2 = window.setTimeout(scan, 1200);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);

  const onPick = async (rdns: string) => {
    setPending(rdns);
    await connect(rdns);
    setPending(null);
    if (!useWalletStore.getState().error && useWalletStore.getState().address) onConnected?.();
  };

  if (wallets.length === 0) {
    return (
      <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
          <AlertTriangle size={13} className="text-amber-400" /> No EVM wallet detected
        </div>
        Install{" "}
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent hover:underline">
          MetaMask <ExternalLink size={9} />
        </a>{" "}
        or{" "}
        <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent hover:underline">
          Phantom <ExternalLink size={9} />
        </a>
        , then reload.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {wallets.map((w) => {
        const busy = connecting && pending === w.rdns;
        return (
          <button
            key={w.rdns}
            onClick={() => onPick(w.rdns)}
            disabled={connecting}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/15 py-2.5 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/25 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : w.icon ? (
              <img src={w.icon} alt="" className="h-4 w-4 rounded" />
            ) : (
              <Wallet size={15} />
            )}
            {busy ? "Check your wallet…" : `Connect ${w.name}`}
          </button>
        );
      })}
      {error && <div className="text-[11px] text-red-300">{error}</div>}
    </div>
  );
}
