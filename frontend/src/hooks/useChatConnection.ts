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

    // Self-heal: demo mode always needs its seed channels (Ansem/Banks/Market
    // Bubble). If a prior live session left the account list empty, restore them
    // so the dashboard never shows zero viewers / no channels in demo.
    if (demo && useConnectionsStore.getState().accounts.length === 0) {
      useConnectionsStore.getState().setAccounts(DEMO_ACCOUNTS);
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

    // Emotes: load 7TV/BTTV/FFZ global sets + per-channel sets for every
    // connected Twitch channel so chat renders real emote images.
    initEmotes(useConnectionsStore.getState().accounts.filter((a) => a.platform === "twitch").map((a) => a.handle));

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

    // Drive the stats read-model on a steady cadence.
    const ticker = window.setInterval(tick, 1500);

    return () => {
      conn.disconnect();
      window.clearInterval(ticker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
}
