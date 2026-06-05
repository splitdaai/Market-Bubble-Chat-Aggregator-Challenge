import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plug, ShieldCheck, MonitorPlay, Loader2, Check, ExternalLink, Plus, Trash2, Power } from "lucide-react";
import type { Platform } from "@shared/types";
import { CHAT_PLATFORMS, SourceBadge, platformLabel, platformColor } from "./SourceBadge";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useToastStore } from "@/store/toastStore";
import { connectObs, addOverlaySource, type ObsClient } from "@/lib/obs";

// Held at module scope so the connection survives the modal closing/reopening.
let obsClient: ObsClient | null = null;

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

  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState<Platform | null>(null);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");

  const submitAdd = (p: Platform) => {
    if (!handle.trim()) return;
    addAccount(p, handle, name || handle);
    push({ message: `Added ${name || handle} on ${platformLabel(p)} — connecting via OAuth…`, tone: "info" });
    setHandle(""); setName(""); setAdding(null);
  };

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
                      <button
                        onClick={() => { setAdding(adding === p ? null : p); setHandle(""); setName(""); }}
                        className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition"
                        style={{ borderColor: `color-mix(in srgb, ${platformColor(p)} 50%, transparent)`, color: platformColor(p) }}
                      >
                        <Plus size={11} /> {p === "pumpfun" ? "Add Wallet" : "Add Channel"}
                      </button>
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
                            <button onClick={() => removeAccount(a.id)} className="rounded p-1 text-muted transition hover:text-red-300" title="Remove">
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
