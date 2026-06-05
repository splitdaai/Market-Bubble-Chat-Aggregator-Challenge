import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, X, Send, Check, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { sendTip, chainInfo, shortAddr, hasInjectedWallet } from "@/lib/web3";
import { useToastStore } from "@/store/toastStore";

const PRESETS = ["0.005", "0.01", "0.05", "0.1"];

/**
 * Send a non-custodial EVM tip to a wallet-connected viewer. The operator's own
 * wallet signs and broadcasts — this app never holds keys or auto-sends.
 */
export function TipModal({
  recipient,
  onClose,
}: {
  recipient: { name: string; address: string };
  onClose: () => void;
}) {
  const address = useWalletStore((s) => s.address);
  const chainId = useWalletStore((s) => s.chainId);
  const connecting = useWalletStore((s) => s.connecting);
  const connect = useWalletStore((s) => s.connect);
  const push = useToastStore((s) => s.push);

  const [amount, setAmount] = useState("0.01");
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chain = chainId ? chainInfo(chainId) : null;
  const sym = chain?.symbol ?? "ETH";

  const send = async () => {
    if (!address) return;
    setSending(true);
    setError(null);
    try {
      const hash = await sendTip(address, recipient.address, amount);
      setTxHash(hash);
      push({ message: `Tip of ${amount} ${sym} sent to ${recipient.name}`, tone: "ok" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setError(msg);
      push({ message: `Tip failed: ${msg}`, tone: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="vc-glass w-full max-w-sm p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-accent">
            <Wallet size={16} /> Tip {recipient.name}
          </span>
          <button onClick={onClose} className="rounded p-1 text-muted transition hover:text-ink"><X size={16} /></button>
        </div>

        {/* recipient */}
        <div className="mb-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted">Recipient wallet</div>
          <div className="font-mono text-sm text-ink">{shortAddr(recipient.address)}</div>
        </div>

        {txHash ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
              <Check size={26} />
            </div>
            <div className="text-sm font-semibold text-ink">Tip sent!</div>
            {chain?.explorer && (
              <a
                href={`${chain.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                View on {chain.name} <ExternalLink size={12} />
              </a>
            )}
            <button onClick={onClose} className="mt-1 rounded-lg bg-accent/20 px-4 py-1.5 text-sm font-bold text-accent hover:bg-accent/30">Done</button>
          </div>
        ) : !hasInjectedWallet() ? (
          <div className="flex flex-col items-center gap-2 py-3 text-center text-sm text-muted">
            <AlertTriangle size={20} className="text-amber-400" />
            No EVM wallet detected. Install MetaMask, Rabby or Coinbase Wallet to send tips.
          </div>
        ) : !address ? (
          <button
            onClick={connect}
            disabled={connecting}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/20 py-2.5 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30 disabled:opacity-50"
          >
            {connecting ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
            Connect your wallet to tip
          </button>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
              <span>From {shortAddr(address)}</span>
              {chain && <span className="rounded-full bg-white/8 px-2 py-0.5 font-semibold text-ink">{chain.name}</span>}
            </div>

            {/* amount */}
            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                    amount === p ? "border-accent bg-accent/15 text-accent" : "border-white/10 text-muted hover:text-ink"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                className="w-full bg-transparent text-lg font-bold tabular-nums text-ink outline-none"
              />
              <span className="text-sm font-bold text-muted">{sym}</span>
            </div>

            {error && <div className="mb-3 text-xs text-red-300">{error}</div>}

            <button
              onClick={send}
              disabled={sending || !(Number(amount) > 0)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/20 py-2.5 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30 disabled:opacity-50"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? "Confirm in wallet…" : `Send ${amount} ${sym}`}
            </button>
            <p className="mt-2 text-center text-[10px] leading-tight text-muted opacity-70">
              You'll approve this transfer in your wallet. Market Bubble never holds your funds or keys.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
