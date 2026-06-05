import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plug, ShieldCheck, MonitorPlay, Loader2, Check, ExternalLink, Plus, Trash2, Power, LogIn, LayoutDashboard, Copy, Wallet } from "lucide-react";
import type { Platform } from "@shared/types";
import { CHAT_PLATFORMS, SourceBadge, platformLabel, platformColor } from "./SourceBadge";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useToastStore } from "@/store/toastStore";
import { useWalletStore } from "@/store/walletStore";
import { connectObs, addOverlaySource, type ObsClient } from "@/lib/obs";
import { chainInfo, shortAddr, hasInjectedWallet } from "@/lib/web3";

// Held at module scope so the connection survives the modal closing/reopening.
let obsClient: ObsClient | null = null;

const BACKEND = import.meta.env.VITE_BACKEND_URL as string | undefined;

export function ConnectionsManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useConnectionsStore((s) => s.accounts);
  const addAccount = useConnectionsStore((s) => s.addAccount);
  const removeAccount = useConnectionsStore((s) => s.removeAccount);
  const toggleAccount = useConnectionsStore((s) => s.toggleAccount);
  const obs = useConnectionsStore((s) => s.obs);
  const obsConnected = useConnectionsStore((s) => s.obsConnected);
  const obsVersion = useConnectionsStore((s) => s.obsVersion);
  const obsError = useConnectionsStore((s) => s.obsError);
  const obsBusy = useConnectionsStore((s) => s.obsBusy);
  const setObsConfig = useConnectionsStore((s) => s.setObsConfig);
  const setObsState = useConnectionsStore((s) => s.setObsState);
  const push = useToastStore((s) => s.push);

  const walletAddress = useWalletStore((s) => s.address);
  const walletChainId = useWalletStore((s) => s.chainId);
  const walletConnecting = useWalletStore((s) => s.connecting);
  const walletError = useWalletStore((s) => s.error);
  const tipEnabled = useWalletStore((s) => s.tipEnabled);
  const connectWalletNow = useWalletStore((s) => s.connect);
  const disconnectWallet = useWalletStore((s) => s.disconnect);
  const setTipEnabled = useWalletStore((s) => s.setTipEnabled);

  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState<Platform | null>(null);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [dockCopied, setDockCopied] = useState(false);

  // Remove an account locally and, in live mode, revoke it server-side too.
  const removeAccountFull = (id: string) => {
    removeAccount(id);
    if (BACKEND) fetch(`${BACKEND}/auth/account/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  };

  const dockUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?dock=1` : "";
  const copyDock = async () => {
    try {
      await navigator.clipboard.writeText(dockUrl);
      setDockCopied(true);
      push({ message: "OBS dock URL copied", tone: "ok" });
      window.setTimeout(() => setDockCopied(false), 2000);
    } catch {
      push({ message: dockUrl, tone: "info" });
    }
  };

  const submitAdd = (p: Platform) => {
    if (!handle.trim()) return;
    addAccount(p, handle, name || handle);
    push({ message: `Added ${name || handle} on ${platformLabel(p)} (demo)`, tone: "info" });
    setHandle(""); setName(""); setAdding(null);
  };

  // Launch the real OAuth flow in a popup (live mode + configured backend).
  const connectOAuth = (p: Platform) => {
    if (!BACKEND) {
      push({ message: "OAuth needs the backend — set VITE_BACKEND_URL and run the server (see README)", tone: "info" });
      return;
    }
    window.open(`${BACKEND}/auth/${p}/start`, "mb-oauth", "width=620,height=780");
  };

  // Toast when an OAuth popup reports success (the account list updates via socket).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "mb-auth") push({ message: e.data.handle ? `Connected ${e.data.handle}` : "Account connected", tone: "ok" });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [push]);

  const connectObsNow = async () => {
    setObsState({ obsBusy: true, obsError: undefined });
    try {
      obsClient = await connectObs(obs.host, obs.port, password);
      setObsState({ obsConnected: true, obsVersion: obsClient.version, obsBusy: false });
      push({ message: `Connected to OBS ${obsClient.version}`, tone: "ok" });
    } catch (e) {
      setObsState({ obsConnected: false, obsBusy: false, obsError: (e as Error).message });
    }
  };
  const disconnectObs = () => {
    obsClient?.disconnect();
    obsClient = null;
    setObsState({ obsConnected: false, obsVersion: undefined });
  };
  const addOverlay = async () => {
    if (!obsClient) return;
    const url = `${window.location.origin}${window.location.pathname}?overlay=1`;
    try {
      await addOverlaySource(obsClient, url);
      push({ message: "Added Market Bubble overlay to OBS as a Browser Source", tone: "ok" });
    } catch (e) {
      push({ message: `OBS: ${(e as Error).message}`, tone: "error" });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        >
          <motion.div
            className="vc-glass max-h-full w-[560px] overflow-y-auto p-5"
            initial={{ scale: 0.94, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-accent">
                <Plug size={15} /> Connections
              </h2>
              <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            <p className="mb-4 text-[11px] text-muted">
              Add multiple channels per platform — every connected account is aggregated into one feed.
            </p>

            {/* ---- accounts, grouped by platform ---- */}
            <div className="space-y-3">
              {CHAT_PLATFORMS.map((p) => {
                const list = accounts.filter((a) => a.platform === p);
                return (
                  <div key={p} className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SourceBadge platform={p} />
                        <span className="text-[10px] text-muted">{list.filter((a) => a.connected).length}/{list.length} live</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p !== "pumpfun" && (
                          <button
                            onClick={() => connectOAuth(p)}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-white transition hover:opacity-90"
                            style={{ background: `color-mix(in srgb, ${platformColor(p)} 80%, #000)` }}
                            title={`Connect a ${platformLabel(p)} account via OAuth`}
                          >
                            <LogIn size={11} /> Connect
                          </button>
                        )}
                        <button
                          onClick={() => { setAdding(adding === p ? null : p); setHandle(""); setName(""); }}
                          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition"
                          style={{ borderColor: `color-mix(in srgb, ${platformColor(p)} 50%, transparent)`, color: platformColor(p) }}
                          title="Add a channel manually (demo)"
                        >
                          <Plus size={11} /> {p === "pumpfun" ? "Connect Wallet" : "Add"}
                        </button>
                      </div>
                    </div>

                    {/* account rows */}
                    <div className="space-y-1">
                      {list.length === 0 && <div className="px-1 py-1 text-[11px] text-muted opacity-70">No channels yet.</div>}
                      {list.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${a.connected ? "bg-emerald-400" : "bg-white/25"}`} />
                            <span className="text-sm font-semibold text-ink">{a.displayName}</span>
                            <span className="text-[10px] text-muted">{a.handle}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleAccount(a.id)} title={a.connected ? "Disconnect" : "Connect"}
                              className={`rounded p-1 transition ${a.connected ? "text-emerald-400 hover:text-emerald-300" : "text-muted hover:text-ink"}`}>
                              <Power size={13} />
                            </button>
                            <button onClick={() => removeAccountFull(a.id)} className="rounded p-1 text-muted transition hover:text-red-300" title="Remove">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* add form */}
                    {adding === p && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <input autoFocus value={handle} onChange={(e) => setHandle(e.target.value)}
                          placeholder={p === "pumpfun" ? "wallet / token" : p === "x" || p === "youtube" ? "@handle" : "channel"}
                          className="vc-input flex-1 text-xs" onKeyDown={(e) => e.key === "Enter" && submitAdd(p)} />
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Label (Ansem)"
                          className="vc-input flex-1 text-xs" onKeyDown={(e) => e.key === "Enter" && submitAdd(p)} />
                        <button onClick={() => submitAdd(p)} className="rounded-md bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30">Add</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ---- OBS ---- */}
            <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <MonitorPlay size={13} /> OBS Studio
            </h3>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              {!obsConnected ? (
                <>
                  <div className="grid grid-cols-[1fr_88px] gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted">Host</span>
                      <input value={obs.host} onChange={(e) => setObsConfig({ host: e.target.value })} className="vc-input font-mono text-xs" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted">Port</span>
                      <input value={obs.port} onChange={(e) => setObsConfig({ port: Number(e.target.value) || 4455 })} className="vc-input font-mono text-xs" />
                    </label>
                  </div>
                  <label className="mt-2 block">
                    <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted">WebSocket password</span>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="from OBS → Tools → WebSocket Server Settings" className="vc-input font-mono text-xs" />
                  </label>
                  {obsError && <div className="mt-2 text-[11px] text-red-400">{obsError}</div>}
                  <button onClick={connectObsNow} disabled={obsBusy}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent/20 py-2 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30 disabled:opacity-50">
                    {obsBusy ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />}
                    {obsBusy ? "Connecting…" : "Connect to OBS"}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400"><Check size={14} /> Connected · OBS {obsVersion}</span>
                    <button onClick={disconnectObs} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-muted hover:text-red-300">Disconnect</button>
                  </div>
                  <button onClick={addOverlay} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-accent/50 bg-accent/15 py-2 text-sm font-bold text-accent transition hover:bg-accent/25">
                    <ExternalLink size={15} /> Add Viewer Overlay to OBS
                  </button>
                </>
              )}
            </div>

            {/* ---- OBS dock (use as a plugin) ---- */}
            <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <LayoutDashboard size={13} /> Use as an OBS Dock
            </h3>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="mb-2 text-[11px] leading-relaxed text-muted">
                Dock the Market Bubble feed right inside OBS — like a plugin. In OBS go to{" "}
                <span className="font-semibold text-ink">Docks → Custom Browser Docks</span>, give it a name, and paste this URL:
              </p>
              <div className="flex items-center gap-1.5">
                <input readOnly value={dockUrl} className="vc-input flex-1 font-mono text-[11px]" onFocus={(e) => e.target.select()} />
                <button onClick={copyDock} className="flex items-center gap-1 rounded-md bg-accent/20 px-2.5 py-1.5 text-xs font-bold text-accent hover:bg-accent/30">
                  {dockCopied ? <Check size={13} /> : <Copy size={13} />} Copy
                </button>
              </div>
              <a href={dockUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-muted hover:text-accent">
                <ExternalLink size={11} /> Preview the dock
              </a>
            </div>

            {/* ---- Tipping wallet (EVM) ---- */}
            <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <Wallet size={13} /> Tipping Wallet
            </h3>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="mb-3 text-[11px] leading-relaxed text-muted">
                Connect your EVM wallet to tip viewers who've linked theirs. Tippable viewers show a{" "}
                <Wallet size={11} className="inline text-emerald-400" /> in chat and the user list. Non-custodial — every
                tip is approved in your wallet.
              </p>

              {!hasInjectedWallet() ? (
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-200/90">
                  No EVM wallet detected. Install MetaMask, Rabby or Coinbase Wallet, then reload.
                </div>
              ) : !walletAddress ? (
                <>
                  <button
                    onClick={connectWalletNow}
                    disabled={walletConnecting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/20 py-2 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30 disabled:opacity-50"
                  >
                    {walletConnecting ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
                    {walletConnecting ? "Check your wallet…" : "Connect EVM Wallet"}
                  </button>
                  {walletError && <div className="mt-2 text-[11px] text-red-400">{walletError}</div>}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                      <Check size={14} /> {shortAddr(walletAddress)}
                      {walletChainId && <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold text-ink">{chainInfo(walletChainId).name}</span>}
                    </span>
                    <button onClick={disconnectWallet} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-muted hover:text-red-300">Disconnect</button>
                  </div>
                  <label className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                    <span className="text-xs font-semibold text-ink">Show tip button on wallet-connected viewers</span>
                    <input type="checkbox" checked={tipEnabled} onChange={(e) => setTipEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--vc-accent)]" />
                  </label>
                </>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-2.5 text-[10px] leading-relaxed text-muted">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
              <span>
                Market Bubble never stores platform passwords. Each channel connects through its platform's official
                OAuth and tokens stay server-side. Your OBS WebSocket password stays on this device.
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
