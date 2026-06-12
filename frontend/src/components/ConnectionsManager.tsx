import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plug, ShieldCheck, MonitorPlay, Loader2, Check, ExternalLink, Plus, Trash2, Power, LogIn, LayoutDashboard, Copy, Wallet, MessagesSquare } from "lucide-react";
import type { Platform } from "@shared/types";
import { CHAT_PLATFORMS, SourceBadge, platformLabel, platformColor } from "./SourceBadge";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useModeStore } from "@/store/modeStore";
import { useToastStore } from "@/store/toastStore";
import { useWalletStore } from "@/store/walletStore";
import { connectObs, addOverlaySource, addChatSource, type ObsClient } from "@/lib/obs";
import { track } from "@/lib/debugLog";
import { chainInfo, shortAddr } from "@/lib/web3";
import { WalletButtons } from "./WalletButtons";

// Held at module scope so the connection survives the modal closing/reopening.
let obsClient: ObsClient | null = null;

const BACKEND = import.meta.env.VITE_BACKEND_URL as string | undefined;

/** Max accounts a single platform can aggregate. */
const MAX_ACCOUNTS = 5;

/** The backend .env vars each platform's OAuth needs, shown when it isn't set up. */
const OAUTH_ENV: Partial<Record<Platform, string>> = {
  twitch: "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET",
  youtube: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
  x: "X_CLIENT_ID / X_CLIENT_SECRET",
  kick: "KICK_CLIENT_ID / KICK_CLIENT_SECRET",
};

export function ConnectionsManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useConnectionsStore((s) => s.accounts);
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
  const walletName = useWalletStore((s) => s.wallet);
  const tipEnabled = useWalletStore((s) => s.tipEnabled);
  const disconnectWallet = useWalletStore((s) => s.disconnect);
  const setTipEnabled = useWalletStore((s) => s.setTipEnabled);

  const [password, setPassword] = useState("");
  const [dockCopied, setDockCopied] = useState(false);
  // Which platforms have server-side OAuth credentials (from GET /auth/config).
  // null = not yet known (demo / no backend) → treat as "Connect".
  const [oauthConfig, setOauthConfig] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (!open || !BACKEND) return;
    let alive = true;
    fetch(`${BACKEND}/auth/config`)
      .then((r) => r.json())
      .then((d) => { if (alive) setOauthConfig(d?.configured ?? {}); })
      .catch(() => { if (alive) setOauthConfig({}); });
    return () => { alive = false; };
  }, [open]);

  // Remove an account locally and, in live mode, revoke it server-side too.
  const removeAccountFull = (id: string) => {
    removeAccount(id);
    if (BACKEND) fetch(`${BACKEND}/auth/account/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  };

  // Watch an arbitrary public channel (Twitch/Kick read no-auth by channel name).
  // Demo: added to the local store (mock chat picks it up). Live: registered on
  // the backend, which spins up a real anonymous chat connector.
  const addAccount = useConnectionsStore((s) => s.addAccount);
  const demo = useModeStore((s) => s.demo);
  const [watchInput, setWatchInput] = useState<Record<string, string>>({});
  const watchChannel = async (p: Platform) => {
    const ch = (watchInput[p] ?? "").trim().replace(/^[@#]/, "").toLowerCase();
    if (!/^[a-z0-9_]{2,30}$/.test(ch)) { push({ message: "Enter a valid channel name (letters, numbers, _)", tone: "error" }); return; }
    // Demo always shows the canonical trio — watching extra channels is live-only.
    if (demo) { push({ message: "Demo shows the Market Bubble trio — switch to LIVE to watch any channel", tone: "info" }); return; }
    addAccount(p, ch, ch);
    setWatchInput((s) => ({ ...s, [p]: "" }));
    if (!demo && BACKEND) {
      try {
        const r = await fetch(`${BACKEND}/auth/watch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: p, channel: ch }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        push({ message: `Watching ${ch} — its ${platformLabel(p)} chat now streams into the feed`, tone: "ok" });
      } catch (e) {
        push({ message: `Couldn't watch ${ch}: ${e instanceof Error ? e.message : e}`, tone: "error" });
      }
    } else {
      push({ message: `Added ${ch} (${platformLabel(p)}) to the feed`, tone: "ok" });
    }
  };
  const watchXBroadcast = async () => {
    const url = (watchInput.x ?? "").trim();
    if (!url) { push({ message: "Paste an X broadcast URL or ID", tone: "error" }); return; }
    if (demo) { push({ message: "Switch to LIVE to watch an X broadcast chat", tone: "info" }); return; }
    if (!BACKEND) { push({ message: "X broadcast chat needs the backend — set VITE_BACKEND_URL and run the server", tone: "info" }); return; }

    try {
      const r = await fetch(`${BACKEND}/api/x-broadcast-chat/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const title = String(j.title || "X Broadcast");
      addAccount("x", String(j.id), title);
      setWatchInput((s) => ({ ...s, x: "" }));
      push({ message: `Watching ${title} — ${Number(j.messages ?? 0)} X messages backfilled`, tone: "ok" });
    } catch (e) {
      push({ message: `Couldn't watch X broadcast: ${e instanceof Error ? e.message : e}`, tone: "error" });
    }
  };

  // Two distinct OBS chat sources:
  //   chatSourceUrl — the polished "Chat Only" panel (`?broadcast=1`) meant to
  //     sit center-screen between the hosts. Add it in OBS as a Browser Source.
  //   dockUrl       — the slim sidebar dock (`?dock=1`) for OBS Custom Browser
  //     Docks (in-OBS chat monitor while you stream).
  const chatSourceUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?broadcast=1` : "";
  const dockUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?dock=1` : "";
  const copyChatSource = async () => {
    try {
      await navigator.clipboard.writeText(chatSourceUrl);
      setDockCopied(true);
      push({ message: "OBS chat-source URL copied — add it in OBS as a Browser Source", tone: "ok" });
      window.setTimeout(() => setDockCopied(false), 2000);
    } catch {
      push({ message: chatSourceUrl, tone: "info" });
    }
  };
  const copyDock = async () => {
    try {
      await navigator.clipboard.writeText(dockUrl);
      push({ message: "OBS dock URL copied", tone: "ok" });
    } catch {
      push({ message: dockUrl, tone: "info" });
    }
  };

  // Launch the real OAuth flow in a popup (live mode + configured backend).
  const connectOAuth = (p: Platform) => {
    if (!BACKEND) {
      push({ message: "OAuth needs the backend — set VITE_BACKEND_URL and run the server (see README)", tone: "info" });
      return;
    }
    // Don't pop a window onto a raw "not configured" backend error — tell the
    // operator exactly which keys to set instead.
    if (oauthConfig && oauthConfig[p] === false) {
      push({
        message: `${platformLabel(p)} OAuth isn't set up — add ${OAUTH_ENV[p] ?? "its CLIENT_ID/SECRET"} to backend/.env and restart the server (see OAUTH_SETUP.md).`,
        tone: "info",
      });
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
    track("obs", `Connecting to ${obs.host}:${obs.port}`);
    try {
      obsClient = await connectObs(obs.host, obs.port, password);
      setObsState({ obsConnected: true, obsVersion: obsClient.version, obsBusy: false });
      track("obs", `Connected to OBS ${obsClient.version}`);
      push({ message: `Connected to OBS ${obsClient.version}`, tone: "ok" });
    } catch (e) {
      const msg = (e as Error).message;
      setObsState({ obsConnected: false, obsBusy: false, obsError: msg });
      // Direct console.error so it lands in the debug log as a real error,
      // not just a tracked event — Connections failures are operator-blocking.
      console.error("OBS connect failed:", msg);
    }
  };
  const disconnectObs = () => {
    obsClient?.disconnect();
    obsClient = null;
    setObsState({ obsConnected: false, obsVersion: undefined });
    track("obs", "Disconnected from OBS");
  };
  const addOverlay = async () => {
    if (!obsClient) return;
    const url = `${window.location.origin}${window.location.pathname}?overlay=1`;
    try {
      await addOverlaySource(obsClient, url);
      track("obs", "Added viewer overlay to OBS", { url });
      push({ message: "Added Market Bubble overlay to OBS as a Browser Source", tone: "ok" });
    } catch (e) {
      console.error("OBS addOverlay failed:", (e as Error).message);
      push({ message: `OBS: ${(e as Error).message}`, tone: "error" });
    }
  };
  const addChat = async () => {
    if (!obsClient) return;
    try {
      await addChatSource(obsClient, chatSourceUrl);
      track("obs", "Added chat source to OBS", { url: chatSourceUrl });
      push({ message: "Added Market Bubble chat to OBS — it's now a Browser Source in your current scene", tone: "ok" });
    } catch (e) {
      console.error("OBS addChat failed:", (e as Error).message);
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
            <p className="mb-2 text-[11px] text-muted">
              Add multiple channels per platform — every connected account is aggregated into one feed.
            </p>
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5 text-[10px] leading-relaxed text-amber-200/80">
              <LogIn size={13} className="mt-0.5 shrink-0 text-amber-300" />
              <span>
                <span className="font-semibold text-amber-200">Adding a different channel?</span> Google/YouTube shows
                an account picker automatically. Twitch, X &amp; Kick reuse your current browser login — so to link a{" "}
                <span className="font-semibold text-amber-200">separate</span> account, log into that account first (or
                open this in a private window), then click Add account.
              </span>
            </div>

            {/* ---- accounts, grouped by platform ---- */}
            <div className="space-y-3">
              {CHAT_PLATFORMS.map((p) => {
                const list = accounts.filter((a) => a.platform === p);
                // Unknown (demo / no backend / not loaded) reads as ready → "Connect".
                const oauthReady = !oauthConfig || oauthConfig[p] !== false;
                return (
                  <div key={p} className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SourceBadge platform={p} />
                        <span className="text-[10px] text-muted">{list.filter((a) => a.connected).length}/{list.length} live</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* One OAuth button per platform: Set up → Connect → + Add account.
                            Every click runs the real OAuth flow, so additional accounts
                            are logged in (never typed in by hand). */}
                        <button
                          onClick={() => connectOAuth(p)}
                          disabled={oauthReady && list.length >= MAX_ACCOUNTS}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ background: oauthReady ? `color-mix(in srgb, ${platformColor(p)} 80%, #000)` : "color-mix(in srgb, #f59e0b 35%, #000)" }}
                          title={
                            !oauthReady
                              ? `${platformLabel(p)} OAuth needs ${OAUTH_ENV[p]} in backend/.env`
                              : list.length >= MAX_ACCOUNTS
                                ? `Up to ${MAX_ACCOUNTS} ${platformLabel(p)} accounts`
                                : list.length === 0
                                  ? `Connect a ${platformLabel(p)} account via OAuth`
                                  : p === "youtube"
                                    ? `Add another ${platformLabel(p)} account — pick a different channel in the Google account picker`
                                    : `Add another ${platformLabel(p)} account — log into that channel first (this platform reuses your browser login)`
                          }
                        >
                          {oauthReady && list.length > 0 ? <Plus size={11} /> : <LogIn size={11} />}
                          {!oauthReady ? "Set up" : list.length >= MAX_ACCOUNTS ? `Max ${MAX_ACCOUNTS}` : list.length > 0 ? "Add account" : "Connect"}
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
                            {a.connected ? (
                              <span className="flex items-center gap-0.5 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                                <Check size={9} /> Connected
                              </span>
                            ) : (
                              <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
                                Paused
                              </span>
                            )}
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

                    {/* Watch any public channel — Twitch & Kick chat is readable
                        by name (no login), so the team can pull any channel in. */}
                    {(p === "twitch" || p === "kick") && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); void watchChannel(p); }}
                        className="mt-1.5 flex items-center gap-1.5"
                      >
                        <input
                          value={watchInput[p] ?? ""}
                          onChange={(e) => setWatchInput((s) => ({ ...s, [p]: e.target.value }))}
                          placeholder={`Watch any ${platformLabel(p)} channel — e.g. xqc`}
                          className="vc-input flex-1 text-xs"
                        />
                        <button
                          type="submit"
                          disabled={!(watchInput[p] ?? "").trim()}
                          className="flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 text-[10px] font-bold text-muted transition hover:border-accent/50 hover:text-accent disabled:opacity-40"
                        >
                          <Plus size={11} /> Watch
                        </button>
                      </form>
                    )}
                    {p === "x" && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); void watchXBroadcast(); }}
                        className="mt-1.5 flex items-center gap-1.5"
                      >
                        <input
                          value={watchInput.x ?? ""}
                          onChange={(e) => setWatchInput((s) => ({ ...s, x: e.target.value }))}
                          placeholder="Paste X broadcast URL — x.com/i/broadcasts/..."
                          className="vc-input flex-1 text-xs"
                        />
                        <button
                          type="submit"
                          disabled={!(watchInput.x ?? "").trim()}
                          className="flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 text-[10px] font-bold text-muted transition hover:border-accent/50 hover:text-accent disabled:opacity-40"
                        >
                          <Plus size={11} /> Watch
                        </button>
                      </form>
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
                  <button onClick={addChat} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-accent bg-accent/25 py-2.5 text-sm font-extrabold text-accent shadow-neon transition hover:bg-accent/35">
                    <MessagesSquare size={15} /> Add Chat to OBS · one-click
                  </button>
                  <button onClick={addOverlay} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] py-2 text-sm font-semibold text-ink transition hover:border-white/25">
                    <ExternalLink size={15} /> Add Viewer Overlay to OBS
                  </button>
                </>
              )}
            </div>

            {/* ---- OBS chat source (recommended) ---- */}
            <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              <MessagesSquare size={13} /> OBS Chat Source <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-accent">RECOMMENDED</span>
            </h3>
            <div className="rounded-xl border border-accent/30 bg-accent/[0.04] p-3">
              <p className="mb-2 text-[11px] leading-relaxed text-muted">
                The aggregated chat as an OBS <span className="font-semibold text-ink">Browser Source</span> — a real video source you can place, size and animate inside OBS like any other source. Two ways:
              </p>
              <ol className="mb-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-muted">
                <li><span className="font-semibold text-accent">Best:</span> connect OBS WebSocket above and click <span className="rounded bg-accent/15 px-1 font-semibold text-accent">Add Chat to OBS</span> — adds the source to your current scene in one click.</li>
                <li>Or paste this URL into OBS: <span className="font-semibold text-ink">Sources → + → Browser</span>, paste, OK.</li>
              </ol>
              <div className="flex items-center gap-1.5">
                <input readOnly value={chatSourceUrl} className="vc-input flex-1 font-mono text-[11px]" onFocus={(e) => e.target.select()} />
                <button onClick={copyChatSource} className="flex items-center gap-1 rounded-md bg-accent/20 px-2.5 py-1.5 text-xs font-bold text-accent hover:bg-accent/30">
                  {dockCopied ? <Check size={13} /> : <Copy size={13} />} Copy URL
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted/80">
                Tip: in the Browser source's settings, untick <span className="font-semibold text-ink">"Shutdown source when not visible"</span> so the chat keeps connecting in the background. Recommended size: <span className="font-semibold text-ink">880×624</span>. URL options: <code className="text-accent">&amp;bg=transparent</code> (chroma-free), <code className="text-accent">&amp;fontsize=18</code>, <code className="text-accent">&amp;platform=twitch,kick</code>.
              </p>
              <a href={chatSourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-muted hover:text-accent">
                <ExternalLink size={11} /> Preview the source in a new tab
              </a>
            </div>

            {/* ---- OBS dock (for in-OBS chat monitor) ---- */}
            <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <LayoutDashboard size={13} /> OBS Custom Browser Dock <span className="text-[9px] font-semibold text-muted/70">(optional · for your own monitor)</span>
            </h3>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="mb-2 text-[11px] leading-relaxed text-muted">
                A slim sidebar version of the feed for <span className="font-semibold text-ink">Docks → Custom Browser Docks</span> — so you can read chat without leaving OBS. Not visible to viewers.
              </p>
              <div className="flex items-center gap-1.5">
                <input readOnly value={dockUrl} className="vc-input flex-1 font-mono text-[11px]" onFocus={(e) => e.target.select()} />
                <button onClick={copyDock} className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-white/15">
                  <Copy size={13} /> Copy
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

              {!walletAddress ? (
                <WalletButtons />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-emerald-400">
                      <Check size={14} /> {shortAddr(walletAddress)}
                      {walletName && <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold text-ink">{walletName}</span>}
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
