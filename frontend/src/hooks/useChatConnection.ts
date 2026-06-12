import { useEffect } from "react";
import { connect } from "@/lib/socket";
import { useChatStore } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";
import { useGiveawayStore } from "@/store/giveawayStore";
import { useClipsStore } from "@/store/clipsStore";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useModeStore } from "@/store/modeStore";
import { useConnectionsStore } from "@/store/connectionsStore";
import { DEMO_ACCOUNTS } from "@/lib/accounts";
import { initEmotes } from "@/lib/emotes";
import { setViewerWallet } from "@/lib/viewerWallets";
import { useViewerStore } from "@/store/viewerStore";
import { useWalletStore } from "@/store/walletStore";

/**
 * Boots the transport (real Socket.io if VITE_BACKEND_URL is set, else the mock
 * firehose) and pipes messages + statuses into the chat store. Every message is
 * also fed to the stats engine, which a 1.5s ticker turns into the live
 * dashboard read-model. Mounted once.
 */
export function useChatConnection() {
  const addMessage = useChatStore((s) => s.addMessage);
  const setStatuses = useChatStore((s) => s.setStatuses);
  const setMock = useChatStore((s) => s.setMock);
  const demo = useModeStore((s) => s.demo);

  useEffect(() => {
    const ingest = useStatsStore.getState().ingest;
    const tick = useStatsStore.getState().tick;
    const applyBackendStats = useStatsStore.getState().applyBackendStats;
    const giveawayIngest = useGiveawayStore.getState().ingest;

    // Switching mode wipes any stale data so demo numbers never leak into live.
    useStatsStore.getState().reset();
    useChatStore.getState().clear();

    // Demo mode is EXACTLY the canonical trio (Ansem / Banks / Market Bubble) —
    // no extra channels ever (watch-any-channel is a Live-mode feature). Restore
    // the seed if a live session or stray addition changed the list.
    if (demo) {
      const accs = useConnectionsStore.getState().accounts;
      const exact = accs.length === DEMO_ACCOUNTS.length && accs.every((a) => DEMO_ACCOUNTS.some((d) => d.id === a.id));
      if (!exact) useConnectionsStore.getState().setAccounts(DEMO_ACCOUNTS);
    }

    // Analytics history follows the mode: demo seeds rich mock history; live
    // clears it and defers to the backend's `history` event (real data, which
    // may be empty) — so live never shows fake demo streams next to a zero
    // current stream.
    if (demo) {
      useAnalyticsStore.setState({ live: false });
      useAnalyticsStore.getState().ensureSeeded();
    } else {
      useAnalyticsStore.setState({ live: true, sessions: [] });
    }

    // Emotes are visual enhancement, not first paint. Let the dashboard become
    // interactive before opening several third-party emote requests.
    const loadEmotes = () => {
      initEmotes(useConnectionsStore.getState().accounts.filter((a) => a.platform === "twitch").map((a) => a.handle));
    };
    const cancelEmoteLoad = (() => {
      if ("requestIdleCallback" in window) {
        const idleId = window.requestIdleCallback(loadEmotes, { timeout: 3500 });
        return () => window.cancelIdleCallback(idleId);
      }
      const timeoutId = globalThis.setTimeout(loadEmotes, 1500);
      return () => globalThis.clearTimeout(timeoutId);
    })();

    const conn = connect({
      onMessage: (m) => {
        addMessage(m);
        ingest(m);
        giveawayIngest(m);
      },
      onStatus: setStatuses,
    }, demo);
    setMock(conn.isMock);
    useStatsStore.getState().setMock(conn.isMock);
    // Demo mode: start mid-broadcast so stats/leaderboards/analytics look live
    // immediately instead of cold-starting from zero.
    if (conn.isMock) useStatsStore.getState().warmStart();

    // Live viewer/watch-time numbers arrive from the backend over `stats`.
    conn.raw?.on("stats", applyBackendStats);

    // Native platform clips finish cutting server-side → attach their URL.
    conn.raw?.on("clip:created", (clipId, url) => useClipsStore.getState().setExternalUrl(clipId, url));

    // Past streams for the analytics tab arrive from the backend on connect.
    conn.raw?.on("history", (sessions) => useAnalyticsStore.getState().setSessions(sessions));

    // OAuth-authed accounts (live mode) replace the local demo account list —
    // even an empty list, so the demo channels don't leak into live mode.
    // (`conn.raw` only exists for the real backend socket, never in demo.)
    conn.raw?.on("accounts", (accs) => useConnectionsStore.getState().setAccounts(accs));

    // Tip registry (live mode): handle → EVM address for every viewer who
    // registered a tip wallet. Feeds viewerWallet(), which is what puts the 💰
    // tippable icon next to a chat name.
    conn.raw?.on("wallets", (map) => {
      for (const [h, addr] of Object.entries(map)) {
        setViewerWallet(h, addr);
        setViewerWallet(`@${h}`, addr); // chat usernames may carry the @ prefix
      }
    });

    // Drive the stats read-model on a steady cadence.
    const ticker = window.setInterval(tick, 1500);

    return () => {
      conn.disconnect();
      window.clearInterval(ticker);
      cancelEmoteLoad();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // Auto-register the viewer's tip address: once they're signed in with X AND
  // have a wallet connected AND tips enabled, tell the backend; disconnecting
  // the wallet or toggling tips off unregisters. Authenticated by the signed
  // X chat token, so only the real @handle can set its own address.
  const chatToken = useViewerStore((s) => s.chatToken);
  const address = useWalletStore((s) => s.address);
  const tipEnabled = useWalletStore((s) => s.tipEnabled);
  useEffect(() => {
    const BACKEND = import.meta.env.VITE_BACKEND_URL as string | undefined;
    if (demo || !BACKEND || !chatToken) return;
    const evm = address && /^0x[a-fA-F0-9]{40}$/.test(address) ? address : null;
    fetch(`${BACKEND}/api/wallet/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: chatToken, address: tipEnabled ? evm : null }),
    }).catch(() => {});
  }, [demo, chatToken, address, tipEnabled]);
}
