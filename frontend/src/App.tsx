import { useEffect, useState } from "react";
import type { ActionButton } from "@shared/types";
import { Topbar } from "./components/Topbar";
import { EditorCanvas } from "./components/EditorCanvas";
import { ThemeEditor } from "./components/ThemeEditor";
import { ButtonEditor } from "./components/ButtonEditor";
import { Toaster } from "./components/Toaster";
import { ParticleLayer } from "./components/Particles";
import { OverlayLayer } from "./components/OverlayLayer";
import { OverlayPage } from "./components/OverlayPage";
import { DockView } from "./components/DockView";
import { AnalyticsTab } from "./components/analytics/AnalyticsTab";
import { ConnectionsManager } from "./components/ConnectionsManager";
import { UserCard } from "./components/UserCard";
import { useViewStore } from "./store/viewStore";
import { useChatConnection } from "./hooks/useChatConnection";
import { useWalletStore } from "./store/walletStore";

export default function App() {
  // Always boot the data pipeline — both the dashboard and the OBS overlay
  // route consume the same live stats/chat stream.
  useChatConnection();

  // Re-attach to an already-authorized EVM wallet + watch for account changes.
  useEffect(() => useWalletStore.getState().hydrate(), []);

  const view = useViewStore((s) => s.view);
  const [themeOpen, setThemeOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [btnEditor, setBtnEditor] = useState<{ open: boolean; editing: ActionButton | null }>({
    open: false,
    editing: null,
  });

  // Standalone OBS routes: floating viewer overlay (browser source) or the
  // compact dock panel (Custom Browser Dock).
  const params = new URLSearchParams(window.location.search);
  if (params.has("overlay")) return <OverlayPage />;
  if (params.has("dock")) return <DockView />;

  return (
    <div className="vc-aurora vc-grid-texture relative min-h-screen">
      <ParticleLayer />
      <Topbar onOpenTheme={() => setThemeOpen(true)} onOpenConnections={() => setConnOpen(true)} />

      <main className="relative z-10 px-4 pb-24">
        {view === "analytics" ? (
          <AnalyticsTab />
        ) : (
          <EditorCanvas onEditButton={(b) => setBtnEditor({ open: true, editing: b ?? null })} />
        )}
      </main>

      <OverlayLayer />
      <UserCard />
      <ConnectionsManager open={connOpen} onClose={() => setConnOpen(false)} />
      <ThemeEditor open={themeOpen} onClose={() => setThemeOpen(false)} />
      <ButtonEditor
        open={btnEditor.open}
        editing={btnEditor.editing}
        onClose={() => setBtnEditor({ open: false, editing: null })}
      />
      <Toaster />
    </div>
  );
}
