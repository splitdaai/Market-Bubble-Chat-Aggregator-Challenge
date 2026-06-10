import { useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import { GripVertical, RotateCcw, X as XIcon, Plus } from "lucide-react";

const Grid = WidthProvider(GridLayout);

export interface PageGridItem { id: string; x: number; y: number; w: number; h: number; node: React.ReactNode }

/**
 * Drag/resize/add/remove/persist wrapper for a page's panels — same editing model
 * as the Live dashboard, self-contained per page (layout + hidden set in localStorage).
 */
export function PageGrid({ pageKey, items, editMode, titles = {}, defaultHidden = [] }: { pageKey: string; items: PageGridItem[]; editMode: boolean; titles?: Record<string, string>; defaultHidden?: string[] }) {
  const storeKey = `mb-pagegrid-${pageKey}`;
  const hideKey = `${storeKey}-hidden`;
  const def: Layout[] = items.map((i) => ({ i: i.id, x: i.x, y: i.y, w: i.w, h: i.h }));
  const [layout, setLayout] = useState<Layout[]>(() => {
    try {
      const s = localStorage.getItem(storeKey);
      if (s) {
        const saved = JSON.parse(s) as Layout[];
        const ids = new Set(saved.map((l) => l.i));
        return [...saved.filter((l) => items.some((it) => it.id === l.i)), ...def.filter((d) => !ids.has(d.i))];
      }
    } catch { /* ignore */ }
    return def;
  });
  const [hidden, setHidden] = useState<string[]>(() => { try { const s = localStorage.getItem(hideKey); return s ? JSON.parse(s) : defaultHidden; } catch { return defaultHidden; } });
  const [addOpen, setAddOpen] = useState(false);

  const onChange = (l: Layout[]) => { setLayout(l); try { localStorage.setItem(storeKey, JSON.stringify(l)); } catch { /* ignore */ } };
  const saveHidden = (h: string[]) => { setHidden(h); try { localStorage.setItem(hideKey, JSON.stringify(h)); } catch { /* ignore */ } };
  const reset = () => { setLayout(def); saveHidden([]); try { localStorage.removeItem(storeKey); localStorage.removeItem(hideKey); } catch { /* ignore */ } };
  const title = (id: string) => titles[id] ?? id;

  const visible = items.filter((it) => !hidden.includes(it.id));
  const visLayout = layout.filter((l) => visible.some((v) => v.id === l.i));
  const hiddenItems = items.filter((it) => hidden.includes(it.id));

  return (
    <div className="relative">
      {editMode && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent">
          <GripVertical size={13} /> Edit mode — drag the handle, resize the corner, ✕ to remove a tile.
          <div className="relative ml-auto flex items-center gap-2">
            <button onClick={() => setAddOpen((o) => !o)} className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] text-ink hover:bg-white/20"><Plus size={11} /> Add tile{hiddenItems.length ? ` (${hiddenItems.length})` : ""}</button>
            <button onClick={reset} className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] text-ink hover:bg-white/20"><RotateCcw size={11} /> Reset layout</button>
            {addOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAddOpen(false)} />
                <div className="absolute right-0 top-7 z-40 w-56 rounded-xl border border-white/10 bg-[#181818] p-1.5 shadow-xl">
                  {hiddenItems.length === 0 ? (
                    <div className="px-2 py-3 text-center text-[11px] font-normal text-faint">All tiles are shown.</div>
                  ) : (
                    hiddenItems.map((it) => (
                      <button key={it.id} onClick={() => { saveHidden(hidden.filter((h) => h !== it.id)); setAddOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold text-ink hover:bg-accent/15 hover:text-accent"><Plus size={12} /> {title(it.id)}</button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <Grid className="layout" layout={visLayout} cols={12} rowHeight={40} margin={[16, 16]} isDraggable={editMode} isResizable={editMode} draggableHandle=".pg-drag" onLayoutChange={onChange} compactType="vertical">
        {visible.map((it) => (
          <div key={it.id} className={`group relative ${editMode ? "rounded-2xl ring-1 ring-accent/30" : ""}`}>
            {editMode && (
              <>
                <div className="pg-drag absolute left-1/2 top-1 z-20 flex -translate-x-1/2 cursor-move items-center gap-1 rounded-full bg-accent/25 px-2 py-0.5 text-[10px] font-bold text-accent backdrop-blur">
                  <GripVertical size={11} /> {title(it.id)}
                </div>
                <button onClick={() => saveHidden([...hidden, it.id])} title="Remove tile" className="absolute right-1 top-1 z-20 grid h-6 w-6 place-items-center rounded-full bg-down/80 text-white transition hover:bg-down"><XIcon size={13} /></button>
              </>
            )}
            <div className="h-full overflow-auto">{it.node}</div>
          </div>
        ))}
      </Grid>
    </div>
  );
}
