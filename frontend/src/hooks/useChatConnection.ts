import { useEffect } from "react";
import { connect } from "@/lib/socket";
import { useChatStore } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";
import { useGiveawayStore } from "@/store/giveawayStore";
import { useClipsStore } from "@/store/clipsStore";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useModeStore } from "@/store/modeStore";
import { useConnectionsStore } from "@/store/connectionsStore";

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

    // OAuth-authed accounts (live mode) replace the local demo account list.
    conn.raw?.on("accounts", (accs) => { if (accs.length) useConnectionsStore.getState().setAccounts(accs); });

    // Drive the stats read-model on a steady cadence.
    const ticker = window.setInterval(tick, 1500);

    return () => {
      conn.disconnect();
      window.clearInterval(ticker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
}
