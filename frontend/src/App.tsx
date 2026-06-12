import { lazy, Suspense, useEffect, useState } from "react";
import type { ActionButton } from "@shared/types";
import { Topbar } from "./components/Topbar";
import { useViewStore } from "./store/viewStore";
import { useThemeStore } from "./store/themeStore";
import { useChatConnection } from "./hooks/useChatConnection";
import { useWalletStore } from "./store/walletStore";
import { useTourStore } from "./store/tourStore";
import { useXBroadcastChat } from "./hooks/useXBroadcastChat";
import { ScheduleBanner } from "./components/widgets/ShowSchedule";
import { useIsMobile } from "./hooks/useIsMobile";
import { useUiModeStore } from "./store/uiModeStore";
import { useOverlayStore } from "./store/overlayStore";
import { useToastStore } from "./store/toastStore";
import { useUserCardStore } from "./store/userCardStore";
import { useTrafficBeacon } from "./hooks/useTrafficBeacon";

const EditorCanvas = lazy(() => import("./components/EditorCanvas").then((m) => ({ default: m.EditorCanvas })));
const MarketTab = lazy(() => import("./components/market/MarketTab").then((m) => ({ default: m.MarketTab })));
const MarketTabClassic = lazy(() => import("./components/market/MarketTabClassic").then((m) => ({ default: m.MarketTabClassic })));
const ContentTab = lazy(() => import("./components/content/ContentTab").then((m) => ({ default: m.ContentTab })));
const KolTab = lazy(() => import("./components/kol/KolTab").then((m) => ({ default: m.KolTab })));
const ThemeEditor = lazy(() => import("./components/ThemeEditor").then((m) => ({ default: m.ThemeEditor })));
const ButtonEditor = lazy(() => import("./components/ButtonEditor").then((m) => ({ default: m.ButtonEditor })));
const OverlayPage = lazy(() => import("./components/OverlayPage").then((m) => ({ default: m.OverlayPage })));
const DockView = lazy(() => import("./components/DockView").then((m) => ({ default: m.DockView })));
const BroadcastView = lazy(() => import("./components/BroadcastView").then((m) => ({ default: m.BroadcastView })));
const EngagePage = lazy(() => import("./components/EngagePage").then((m) => ({ default: m.EngagePage })));
const AnalyticsTab = lazy(() => import("./components/analytics/AnalyticsTab").then((m) => ({ default: m.AnalyticsTab })));
const ConnectionsManager = lazy(() => import("./components/ConnectionsManager").then((m) => ({ default: m.ConnectionsManager })));
const MobileApp = lazy(() => import("./components/mobile/MobileApp").then((m) => ({ default: m.MobileApp })));
const SimpleApp = lazy(() => import("./components/SimpleApp").then((m) => ({ default: m.SimpleApp })));
const FeaturesModal = lazy(() => import("./components/FeaturesModal").then((m) => ({ default: m.FeaturesModal })));
const UserCard = lazy(() => import("./components/UserCard").then((m) => ({ default: m.UserCard })));
const DebugLogOverlay = lazy(() => import("./components/DebugLogOverlay").then((m) => ({ default: m.DebugLogOverlay })));
const Toaster = lazy(() => import("./components/Toaster").then((m) => ({ default: m.Toaster })));
const OverlayLayer = lazy(() => import("./components/OverlayLayer").then((m) => ({ default: m.OverlayLayer })));
const JudgeTour = lazy(() => import("./components/JudgeTour").then((m) => ({ default: m.JudgeTour })));

export default function App() {
  // Always boot the data pipeline — both the dashboard and the OBS overlay
  // route consume the same live stats/chat stream.
  useChatConnection();
  useXBroadcastChat(); // real X broadcast chat into the feed (guest, zero ban risk)

  // Re-attach to an already-authorized EVM wallet + watch for account changes.
  useEffect(() => useWalletStore.getState().hydrate(), []);

  const view = useViewStore((s) => s.view);
  useTrafficBeacon(view);
  const isMobile = useIsMobile();
  const uiMode = useUiModeStore((s) => s.mode);
  const marketTemplate = useThemeStore((s) => s.marketTemplate);
  const overlayEnabled = useOverlayStore((s) => s.enabled);
  const tourActive = useTourStore((s) => s.active);
  const hasToasts = useToastStore((s) => s.toasts.length > 0);
  const userCardOpen = useUserCardStore((s) => s.open !== null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [btnEditor, setBtnEditor] = useState<{ open: boolean; editing: ActionButton | null }>({
    open: false,
    editing: null,
  });

  // `?tour` deep link (used in the README) — land in Pro and start the
  // 60-second Judge Tour automatically.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("tour")) {
      useUiModeStore.getState().setMode("pro");
      useTourStore.getState().start();
    }
  }, []);

  // Standalone OBS routes: floating viewer overlay (browser source) or the
  // compact dock panel (Custom Browser Dock).
  const params = new URLSearchParams(window.location.search);
  if (params.has("overlay")) return <Suspense fallback={null}><OverlayPage /></Suspense>;
  if (params.has("dock")) return <Suspense fallback={null}><DockView /></Suspense>;
  if (params.has("engage")) return <Suspense fallback={null}><EngagePage /></Suspense>;
  if (params.has("broadcast")) {
    // Full chat toolkit rides along: click-a-user card (history / timeout /
    // ban / tip via TipModal inside UserCard) + toasts for mod confirmations.
    return (
      <Suspense fallback={null}>
        <BroadcastView onOpenConnections={() => setConnOpen(true)} />
        {connOpen && <ConnectionsManager open={connOpen} onClose={() => setConnOpen(false)} />}
        {userCardOpen && <UserCard />}
        {hasToasts && <Toaster />}
      </Suspense>
    );
  }

  // Phones get a dedicated mobile shell (bottom-tab native feel). The desktop
  // dashboard below is left completely untouched. `?desktop` forces the full UI;
  // `?mobile` forces the mobile shell (handy for previewing on a laptop).
  if ((isMobile || params.has("mobile")) && !params.has("desktop")) {
    return <Suspense fallback={null}><MobileApp /></Suspense>;
  }

  // Bare visit (no query at all) → land on the Chat Only page with an
  // onboarding popup. Any param (?app, ?pro, ?simple, ?tour, ...) skips this
  // and goes straight to the dashboard shells below.
  if (window.location.search === "") {
    return (
      <Suspense fallback={null}>
        <BroadcastView landing onOpenConnections={() => setConnOpen(true)} />
        {connOpen && <ConnectionsManager open={connOpen} onClose={() => setConnOpen(false)} />}
        {userCardOpen && <UserCard />}
        {hasToasts && <Toaster />}
      </Suspense>
    );
  }

  // Simple (stock) shell — just stream + unified chat. The "Pro" button reveals
  // the full dashboard. `?pro` / `?simple` force a mode for previewing.
  if (params.has("simple") || (uiMode === "simple" && !params.has("pro"))) {
    return <Suspense fallback={null}><SimpleApp /></Suspense>;
  }

  return (
    <div className="vc-aurora vc-grid-texture relative min-h-screen">
      <Topbar
        onOpenTheme={() => setThemeOpen(true)}
        onOpenConnections={() => setConnOpen(true)}
        onOpenFeatures={() => setFeaturesOpen(true)}
      />

      <main className="relative z-10 px-4 pb-24">
        <Suspense fallback={null}>
          {view === "analytics" ? (
            <AnalyticsTab />
          ) : view === "market" ? (
            marketTemplate === "classic" ? <MarketTabClassic /> : <MarketTab />
          ) : view === "content" ? (
            <ContentTab />
          ) : view === "kol" ? (
            <KolTab />
          ) : (
            <>
              <ScheduleBanner />
              <EditorCanvas onEditButton={(b) => setBtnEditor({ open: true, editing: b ?? null })} />
            </>
          )}
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {overlayEnabled && <OverlayLayer />}
        {tourActive && <JudgeTour />}
      </Suspense>
      <Suspense fallback={null}>
        {userCardOpen && <UserCard />}
        {connOpen && <ConnectionsManager open={connOpen} onClose={() => setConnOpen(false)} />}
        {featuresOpen && <FeaturesModal open={featuresOpen} onClose={() => setFeaturesOpen(false)} />}
        {themeOpen && <ThemeEditor open={themeOpen} onClose={() => setThemeOpen(false)} />}
        {btnEditor.open && (
          <ButtonEditor
            open={btnEditor.open}
            editing={btnEditor.editing}
            onClose={() => setBtnEditor({ open: false, editing: null })}
          />
        )}
        <DebugLogOverlay />
      </Suspense>
      <Suspense fallback={null}>
        {hasToasts && <Toaster />}
      </Suspense>
    </div>
  );
}
