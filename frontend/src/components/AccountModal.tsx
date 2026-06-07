import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X as XIcon, Wallet, Star, LogOut, Check } from "lucide-react";
import { useViewerStore } from "@/store/viewerStore";
import { useWalletStore } from "@/store/walletStore";
import { useWatchlistStore, useOwnerId } from "@/store/watchlistStore";
import { chainInfo } from "@/lib/web3";
import { WalletButtons } from "./WalletButtons";

const trunc = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);

export function AccountModal({ open, onClose, onOpenDashboard }: { open: boolean; onClose: () => void; onOpenDashboard?: () => void }) {
  const { xHandle, xName, connectX, disconnectX } = useViewerStore();
  const address = useWalletStore((s) => s.address);
  const chainId = useWalletStore((s) => s.chainId);
  const walletName = useWalletStore((s) => s.wallet);
  const disconnectWallet = useWalletStore((s) => s.disconnect);
  const owner = useOwnerId();
  const items = useWatchlistStore((s) => s.byOwner[owner] ?? []);
  const removeWatch = useWatchlistStore((s) => s.remove);
  const [handle, setHandle] = useState("");

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="mb-tab mt-16 w-full max-w-lg rounded-2xl border border-white/10 bg-[#111]" initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/8 p-4">
              <div className="serif text-xl font-bold">Your Account</div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><XIcon size={18} /></button>
            </div>

            <div className="space-y-4 p-4">
              {/* X identity */}
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">X account — chat as yourself</div>
                {xHandle ? (
                  <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5">
                    <Check size={15} className="text-accent" />
                    <div className="min-w-0 flex-1"><div className="text-[13px] font-bold">{xName}</div><div className="text-[11px] text-muted">@{xHandle}</div></div>
                    <button onClick={disconnectX} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><LogOut size={15} /></button>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); connectX(handle); setHandle(""); }} className="flex gap-2">
                    <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2"><span className="text-faint">@</span><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="your_x_handle" className="w-full bg-transparent text-sm outline-none placeholder:text-faint" /></div>
                    <button type="submit" className="rounded-xl bg-accent px-4 text-sm font-bold text-black shadow-neon">Connect X</button>
                  </form>
                )}
              </div>

              {/* Wallet */}
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Wallet — MetaMask · Phantom · Jupiter</div>
                {address ? (
                  <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5">
                    <Wallet size={15} className="text-accent" />
                    <div className="min-w-0 flex-1"><div className="font-mono text-[13px] font-bold">{trunc(address)}</div><div className="text-[11px] text-muted">{walletName} · {chainId ? chainInfo(chainId).name : "—"}</div></div>
                    <button onClick={disconnectWallet} className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink"><LogOut size={15} /></button>
                  </div>
                ) : (
                  <>
                    <WalletButtons onConnected={() => { /* stays open to show state */ }} />
                    <a href="https://jup.ag/mobile" target="_blank" rel="noreferrer" className="mt-1.5 block text-[10px] text-faint hover:text-accent">Jupiter is a Solana wallet — connect via Phantom for Solana, or use its in-app browser ↗</a>
                  </>
                )}
              </div>

              {/* Watchlist */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><Star size={12} className="text-gold" /> Watchlist ({items.length})
                  {items.length > 0 && onOpenDashboard && <button onClick={() => { onClose(); onOpenDashboard(); }} className="ml-auto rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/25">Open dashboard →</button>}
                </div>
                {items.length === 0 ? (
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-4 text-center text-[12px] text-muted">Tap the ☆ on any asset, trader, portfolio or KOL to add it here.</div>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {items.map((it) => (
                      <div key={it.key} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                        <span className="rounded bg-white/8 px-1 text-[9px] font-bold uppercase text-faint">{it.type}</span>
                        <span className="text-[12.5px] font-semibold">{it.label}</span>
                        {it.sub && <span className="text-[10px] text-muted">{it.sub}</span>}
                        <button onClick={() => removeWatch(owner, it.key)} className="ml-auto rounded p-1 text-faint hover:text-down"><XIcon size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-center text-[10px] text-faint">Non-custodial — we only read your public address/handle. Your watchlist is saved to your connected account.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
