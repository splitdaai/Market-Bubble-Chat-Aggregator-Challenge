import { useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import { GripVertical, RotateCcw } from "lucide-react";

const Grid = WidthProvider(GridLayout);

export interface PageGridItem { id: string; x: number; y: number; w: number; h: number; node: React.ReactNode }

/**
 * Drag/resize/persist wrapper for a page's panels — the same editing model as the
 * Live dashboard, but self-contained per page (layout saved to localStorage).
 * Editing is gated by the global `editMode`; otherwise it renders a static grid.
 */
export function PageGrid({ pageKey, items, editMode }: { pageKey: string; items: PageGridItem[]; editMode: boolean }) {
  const storeKey = `mb-pagegrid-${pageKey}`;
  const def: Layout[] = items.map((i) => ({ i: i.id, x: i.x, y: i.y, w: i.w, h: i.h }));
  const [layout, setLayout] = useState<Layout[]>(() => {
    try {
      const s = localStorage.getItem(storeKey);
      if (s) {
        const saved = JSON.parse(s) as Layout[];
        const ids = new Set(saved.map((l) => l.i));
        // keep saved positions, append any new panels not yet placed
        return [...saved.filter((l) => items.some((it) => it.id === l.i)), ...def.filter((d) => !ids.has(d.i))];
      }
    } catch { /* ignore */ }
    return def;
  });

  const onChange = (l: Layout[]) => { setLayout(l); try { localStorage.setItem(storeKey, JSON.stringify(l)); } catch { /* ignore */ } };
  const reset = () => { setLayout(def); try { localStorage.removeItem(storeKey); } catch { /* ignore */ } };

  return (
    <div className="relative">
      {editMode && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent">
          <GripVertical size={13} /> Edit mode — drag panels by their handle, drag the corner to resize.
          <button onClick={reset} className="ml-auto flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] text-ink hover:bg-white/20"><RotateCcw size={11} /> Reset layout</button>
        </div>
      )}
      <Grid
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={40}
        margin={[16, 16]}
        isDraggable={editMode}
        isResizable={editMode}
        draggableHandle=".pg-drag"
        onLayoutChange={onChange}
        compactType="vertical"
      >
        {items.map((it) => (
          <div key={it.id} className={`group relative ${editMode ? "rounded-2xl ring-1 ring-accent/30" : ""}`}>
            {editMode && (
              <div className="pg-drag absolute left-1/2 top-1 z-20 flex -translate-x-1/2 cursor-move items-center gap-1 rounded-full bg-accent/25 px-2 py-0.5 text-[10px] font-bold text-accent backdrop-blur">
                <GripVertical size={11} /> drag
              </div>
            )}
            <div className="h-full overflow-auto">{it.node}</div>
          </div>
        ))}
      </Grid>
    </div>
  );
}
