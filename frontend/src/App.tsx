import { lazy, Suspense, useEffect, useState } from "react";
import type { ActionButton } from "@shared/types";
import { Topbar } from "./components/Topbar";
import { Toaster } from "./components/Toaster";
import { ParticleLayer } from "./components/Particles";
import { OverlayLayer } from "./components/OverlayLayer";
import { useViewStore } from "./store/viewStore";
import { useChatConnection } from "./hooks/useChatConnection";
import { useWalletStore } from "./store/walletStore";

const EditorCanvas = lazy(() => import("./components/EditorCanvas").then((m) => ({ default: m.EditorCanvas })));
const MarketTab = lazy(() => import("./components/market/MarketTab").then((m) => ({ default: m.MarketTab })));
const ContentTab = lazy(() => import("./components/content/ContentTab").then((m) => ({ default: m.ContentTab })));
const ThemeEditor = lazy(() => import("./components/ThemeEditor").then((m) => ({ default: m.ThemeEditor })));
const ButtonEditor = lazy(() => import("./components/ButtonEditor").then((m) => ({ default: m.ButtonEditor })));
const OverlayPage = lazy(() => import("./components/OverlayPage").then((m) => ({ default: m.OverlayPage })));
const DockView = lazy(() => import("./components/DockView").then((m) => ({ default: m.DockView })));
const AnalyticsTab = lazy(() => import("./components/analytics/AnalyticsTab").then((m) => ({ default: m.AnalyticsTab })));
const ConnectionsManager = lazy(() => import("./components/ConnectionsManager").then((m) => ({ default: m.ConnectionsManager })));
const FeaturesModal = lazy(() => import("./components/FeaturesModal").then((m) => ({ default: m.FeaturesModal })));
const UserCard = lazy(() => import("./components/UserCard").then((m) => ({ default: m.UserCard })));

export default function App() {
  // Always boot the data pipeline — both the dashboard and the OBS overlay
  // route consume the same live stats/chat stream.
  useChatConnection();

  // Re-attach to an already-authorized EVM wallet + watch for account changes.
  useEffect(() => useWalletStore.getState().hydrate(), []);

  const view = useViewStore((s) => s.view);
  const [themeOpen, setThemeOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [btnEditor, setBtnEditor] = useState<{ open: boolean; editing: ActionButton | null }>({
    open: false,
    editing: null,
  });

  // Standalone OBS routes: floating viewer overlay (browser source) or the
  // compact dock panel (Custom Browser Dock).
  const params = new URLSearchParams(window.location.search);
  if (params.has("overlay")) return <Suspense fallback={null}><OverlayPage /></Suspense>;
  if (params.has("dock")) return <Suspense fallback={null}><DockView /></Suspense>;

  return (
    <div className="vc-aurora vc-grid-texture relative min-h-screen">
      <ParticleLayer />
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
            <MarketTab />
          ) : view === "content" ? (
            <ContentTab />
          ) : (
            <EditorCanvas onEditButton={(b) => setBtnEditor({ open: true, editing: b ?? null })} />
          )}
        </Suspense>
      </main>

      <OverlayLayer />
      <Suspense fallback={null}>
        <UserCard />
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
      </Suspense>
      <Toaster />
    </div>
  );
}
