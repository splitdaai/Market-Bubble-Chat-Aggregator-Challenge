import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, X, Send, Check, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { sendToken, tokenFor, stablesOn, chainInfo, shortAddr, switchToEthereum, type Stable } from "@/lib/web3";
import { useToastStore } from "@/store/toastStore";
import { WalletButtons } from "./WalletButtons";

const PRESETS = ["5", "10", "25", "50"];

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
  const wallet = useWalletStore((s) => s.wallet);
  const push = useToastStore((s) => s.push);

  const [amount, setAmount] = useState("10");
  const [token, setToken] = useState<Stable>("USDC");
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chain = chainId ? chainInfo(chainId) : null;
  const available = stablesOn(chainId); // which of USDC/USDT exist on this chain
  const activeToken = available.includes(token) ? token : available[0];
  const tokenInfo = activeToken ? tokenFor(chainId, activeToken) : undefined;

  const [switching, setSwitching] = useState(false);
  const switchEth = async () => {
    setSwitching(true);
    setError(null);
    try {
      await switchToEthereum(); // wallet emits chainChanged → store updates → USDC/USDT appear
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch network");
    } finally {
      setSwitching(false);
    }
  };

  // Auto-prompt the switch to Ethereum once, if connected on an unsupported chain.
  const triedSwitch = useRef(false);
  useEffect(() => {
    if (address && chainId && available.length === 0 && !triedSwitch.current) {
      triedSwitch.current = true;
      switchEth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId, available.length]);

  const send = async () => {
    if (!address || !tokenInfo || !activeToken) return;
    setSending(true);
    setError(null);
    try {
      const hash = await sendToken(address, tokenInfo, recipient.address, amount);
      setTxHash(hash);
      push({ message: `Tip of $${amount} ${activeToken} sent to ${recipient.name}`, tone: "ok" });
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
        ) : !address ? (
          <div>
            <p className="mb-2 text-center text-[11px] text-muted">Connect MetaMask or Phantom to send a tip</p>
            <WalletButtons />
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
              <span>From {shortAddr(address)}{wallet ? ` · ${wallet}` : ""}</span>
              {chain && <span className="rounded-full bg-white/8 px-2 py-0.5 font-semibold text-ink">{chain.name}</span>}
            </div>

            {!activeToken ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-3 text-center text-[12px] text-amber-200/90">
                <AlertTriangle size={18} className="text-amber-400" />
                <span>No USDC/USDT on {chain?.name ?? "this network"}. Tips run on Ethereum (or Base / Arbitrum / Optimism / Polygon).</span>
                <button
                  onClick={switchEth}
                  disabled={switching}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/20 py-2 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30 disabled:opacity-50"
                >
                  {switching ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
                  {switching ? "Check your wallet…" : "Switch to Ethereum"}
                </button>
                {error && <span className="text-[11px] text-red-300">{error}</span>}
              </div>
            ) : (
              <>
                {/* stablecoin toggle */}
                <div className="mb-2 flex gap-1.5">
                  {(["USDC", "USDT"] as Stable[]).map((s) => {
                    const ok = available.includes(s);
                    return (
                      <button
                        key={s}
                        disabled={!ok}
                        onClick={() => setToken(s)}
                        title={ok ? `Tip in ${s}` : `${s} not on ${chain?.name}`}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition disabled:opacity-30 ${
                          activeToken === s ? "border-accent bg-accent/15 text-accent" : "border-white/10 text-muted hover:text-ink"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>

                {/* amount ($) */}
                <div className="mb-2 grid grid-cols-4 gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setAmount(p)}
                      className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                        amount === p ? "border-accent bg-accent/15 text-accent" : "border-white/10 text-muted hover:text-ink"
                      }`}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-lg font-bold text-muted">$</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    className="w-full bg-transparent text-lg font-bold tabular-nums text-ink outline-none"
                  />
                  <span className="text-sm font-bold text-muted">{activeToken}</span>
                </div>

                {error && <div className="mb-3 text-xs text-red-300">{error}</div>}

                <button
                  onClick={send}
                  disabled={sending || !(Number(amount) > 0)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/20 py-2.5 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {sending ? "Confirm in wallet…" : `Send $${amount} ${activeToken}`}
                </button>
                <p className="mt-2 text-center text-[10px] leading-tight text-muted opacity-70">
                  You'll approve this transfer in your wallet. Market Bubble never holds your funds or keys.
                </p>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
