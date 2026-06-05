import { useEffect, useMemo, useState } from "react";
import GridLayout, { WidthProvider, type Layout as RGLLayout } from "react-grid-layout";
import { useToastStore } from "@/store/toastStore";
import { GripVertical, X, Plus, MessageSquare, Activity, BarChart3, Flame, Zap, Smile, Scissors, Trophy, Gift, Film, Users, Monitor, LayoutGrid, TrendingUp } from "lucide-react";
import { useLayoutStore } from "@/store/layoutStore";
import type { PanelLayout, WidgetKind, ActionButton } from "@shared/types";
import { ChatFeed } from "./ChatFeed";
import { ConnectionStatusWidget } from "./widgets/ConnectionStatusWidget";
import { StatsWidget } from "./widgets/StatsWidget";
import { HypeMeter } from "./widgets/HypeMeter";
import { ButtonDeck } from "./widgets/ButtonDeck";
import { MoodMeter } from "./widgets/MoodMeter";
import { ClipRadar } from "./widgets/ClipRadar";
import { TopChatters } from "./widgets/TopChatters";
import { GiveawayBot } from "./widgets/GiveawayBot";
import { Clips } from "./widgets/Clips";
import { UserList } from "./widgets/UserList";
import { StreamPreview } from "./widgets/StreamPreview";
import { OpsPanel } from "./widgets/OpsPanel";
import { PolymarketPanel } from "./widgets/PolymarketPanel";

const Grid = WidthProvider(GridLayout);

const WIDGET_META: Record<WidgetKind, { label: string; icon: React.ReactNode }> = {
  "chat-feed": { label: "Chat Feed", icon: <MessageSquare size={15} /> },
  "connection-status": { label: "Connections", icon: <Activity size={15} /> },
  stats: { label: "Live Stats", icon: <BarChart3 size={15} /> },
  "hype-meter": { label: "Hype Meter", icon: <Flame size={15} /> },
  "button-deck": { label: "Action Deck", icon: <Zap size={15} /> },
  "mood-meter": { label: "Mood Meter", icon: <Smile size={15} /> },
  "clip-radar": { label: "Clip Radar", icon: <Scissors size={15} /> },
  "top-chatters": { label: "Top Chatters", icon: <Trophy size={15} /> },
  giveaway: { label: "Giveaway Bot", icon: <Gift size={15} /> },
  clips: { label: "Clips", icon: <Film size={15} /> },
  "user-list": { label: "Users", icon: <Users size={15} /> },
  "stream-preview": { label: "Stream Preview", icon: <Monitor size={15} /> },
  ops: { label: "Ops Panel", icon: <LayoutGrid size={15} /> },
  polymarket: { label: "Polymarket", icon: <TrendingUp size={15} /> },
};

function renderWidget(panel: PanelLayout, onEditButton: (b?: ActionButton) => void) {
  switch (panel.widget) {
    case "chat-feed": return <ChatFeed panel={panel} />;
    case "connection-status": return <ConnectionStatusWidget />;
    case "stats": return <StatsWidget />;
    case "hype-meter": return <HypeMeter />;
    case "button-deck": return <ButtonDeck onEdit={onEditButton} />;
    case "mood-meter": return <MoodMeter />;
    case "clip-radar": return <ClipRadar />;
    case "top-chatters": return <TopChatters />;
    case "giveaway": return <GiveawayBot />;
    case "clips": return <Clips />;
    case "user-list": return <UserList />;
    case "stream-preview": return <StreamPreview />;
    case "ops": return <OpsPanel />;
    case "polymarket": return <PolymarketPanel />;
  }
}

/**
 * The visual editor. In edit mode every panel can be dragged (by its handle),
 * resized from the corner, and snaps to a 12-col grid. Geometry persists to
 * localStorage via the layout store. The same canvas, locked, is the live app.
 */
export function EditorCanvas({ onEditButton }: { onEditButton: (b?: ActionButton) => void }) {
  const layout = useLayoutStore((s) => s.layout);
  const editMode = useLayoutStore((s) => s.editMode);
  const updateGeometry = useLayoutStore((s) => s.updateGeometry);
  const removePanel = useLayoutStore((s) => s.removePanel);
  const addPanel = useLayoutStore((s) => s.addPanel);
  const [palette, setPalette] = useState(false);

  // Discoverability hint when entering edit mode.
  useEffect(() => {
    if (editMode) {
      useToastStore.getState().push({
        message: "Edit mode: drag a panel by its header, resize from the bottom-right corner — tiles snap to the grid. Hit + Add Panel to add widgets.",
        tone: "info",
      });
    }
  }, [editMode]);

  const rglLayout: RGLLayout[] = useMemo(
    () =>
      layout.panels.map((p) => ({
        i: p.i, x: p.x, y: p.y, w: p.w, h: p.h, minW: p.minW, minH: p.minH,
      })),
    [layout.panels],
  );

  return (
    <div className={`relative z-10 ${editMode ? "" : "vc-locked"}`}>
      <Grid
        className="layout"
        layout={rglLayout}
        cols={12}
        rowHeight={36}
        margin={[14, 14]}
        isDraggable={editMode}
        isResizable={editMode}
        draggableHandle=".vc-drag-handle"
        onLayoutChange={(l) => updateGeometry(l)}
        compactType="vertical"
        resizeHandles={["se"]}
      >
        {layout.panels.map((panel) => (
          // Grid item is NOT overflow-hidden so the resize handle (a sibling RGL
          // appends at the corner) is never clipped or covered by widget content.
          <div key={panel.i} className="vc-glass relative">
            <div className="flex h-full flex-col overflow-hidden rounded-[inherit]">
              {/* panel chrome — only the grip + close show in edit mode */}
              {editMode && (
                <div className="vc-drag-handle flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-2 py-1">
                  <div className="flex items-center gap-1.5 text-muted">
                    <GripVertical size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {WIDGET_META[panel.widget].label}
                    </span>
                  </div>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => removePanel(panel.i)}
                    className="rounded p-0.5 text-muted transition hover:bg-red-500/20 hover:text-red-300"
                    title="Remove panel"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1">{renderWidget(panel, onEditButton)}</div>
            </div>
          </div>
        ))}
      </Grid>

      {/* Add-panel palette (edit mode only) */}
      {editMode && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          {palette && (
            <div className="vc-glass mb-2 flex gap-1 p-1.5">
              {(Object.keys(WIDGET_META) as WidgetKind[]).map((w) => (
                <button
                  key={w}
                  onClick={() => { addPanel(w); setPalette(false); }}
                  className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-muted transition hover:bg-accent/15 hover:text-accent"
                >
                  {WIDGET_META[w].icon}
                  <span className="text-[10px] font-semibold">{WIDGET_META[w].label}</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setPalette((p) => !p)}
            className="mx-auto flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-bold text-accent shadow-neon backdrop-blur transition hover:bg-accent/25"
          >
            <Plus size={16} className={palette ? "rotate-45 transition" : "transition"} /> Add Panel
          </button>
        </div>
      )}
    </div>
  );
}
