import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2 } from "lucide-react";
import { useLayoutStore } from "@/store/layoutStore";
import type { ActionButton, Platform } from "@shared/types";

const PLATFORMS: Platform[] = ["twitch", "kick", "x", "youtube", "pumpfun"];
const ICONS = ["Swords", "Rocket", "Megaphone", "Timer", "Flame", "Heart", "Zap", "Crown", "Gift", "PartyPopper"];

const blank = (): ActionButton => ({
  id: `b-${Date.now()}`,
  label: "New Action",
  icon: "Zap",
  color: "#b14dff",
  platforms: ["twitch"],
  command: "/command",
});

/** Create / edit a custom action button and save it to the deck. */
export function ButtonEditor({ editing, open, onClose }: { editing: ActionButton | null; open: boolean; onClose: () => void }) {
  const addButton = useLayoutStore((s) => s.addButton);
  const updateButton = useLayoutStore((s) => s.updateButton);
  const removeButton = useLayoutStore((s) => s.removeButton);
  const [draft, setDraft] = useState<ActionButton>(blank());
  const isNew = !editing;

  useEffect(() => {
    if (open) setDraft(editing ? { ...editing } : blank());
  }, [open, editing]);

  const save = () => {
    if (isNew) addButton(draft);
    else updateButton(draft);
    onClose();
  };

  const togglePlatform = (p: Platform) =>
    setDraft((d) => ({
      ...d,
      platforms: d.platforms.includes(p) ? d.platforms.filter((x) => x !== p) : [...d.platforms, p],
    }));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        >
          <motion.div
            className="vc-glass w-[380px] p-5"
            initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-accent">{isNew ? "New Button" : "Edit Button"}</h2>
              <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>

            {/* live preview */}
            <div className="mb-4 grid place-items-center rounded-xl border border-white/10 bg-black/30 py-4">
              <div
                className="flex flex-col items-center gap-1 rounded-xl border px-4 py-2.5"
                style={{
                  borderColor: `color-mix(in srgb, ${draft.color} 45%, transparent)`,
                  background: `color-mix(in srgb, ${draft.color} 10%, transparent)`,
                  color: draft.color,
                  boxShadow: `0 0 16px color-mix(in srgb, ${draft.color} 30%, transparent)`,
                }}
              >
                <span className="text-xs font-bold text-ink">{draft.label || "Label"}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Labeled label="Label">
                <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="vc-input" />
              </Labeled>
              <Labeled label="Command">
                <input value={draft.command} onChange={(e) => setDraft({ ...draft, command: e.target.value })} placeholder="/raid {target}" className="vc-input font-mono" />
              </Labeled>

              <Labeled label="Color">
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
                  <input value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="vc-input flex-1 font-mono" />
                </div>
              </Labeled>

              <Labeled label="Icon">
                <div className="flex flex-wrap gap-1">
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setDraft({ ...draft, icon: ic })}
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition ${
                        draft.icon === ic ? "border-accent text-accent" : "border-white/10 text-muted hover:border-white/30"
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </Labeled>

              <Labeled label="Fires on platforms">
                <div className="flex gap-1.5">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold capitalize transition ${
                        draft.platforms.includes(p) ? "border-accent text-accent" : "border-white/10 text-muted"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Labeled>
            </div>

            <div className="mt-5 flex items-center gap-2">
              {!isNew && (
                <button
                  onClick={() => { removeButton(draft.id); onClose(); }}
                  className="flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/15"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <button
                onClick={save}
                className="ml-auto rounded-lg bg-accent/20 px-5 py-2 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30"
              >
                Save Button
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
