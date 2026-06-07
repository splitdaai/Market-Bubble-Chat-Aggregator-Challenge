import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";
import { THEME_PRESETS, TILE_TEMPLATES, BTN_TEMPLATES, BTN_EFFECTS, TEXT_TEMPLATES } from "@/lib/theme";
import type { Theme } from "@shared/types";

/** Live theme editor — every change writes to :root immediately. */
export function ThemeEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const patch = useThemeStore((s) => s.patch);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-start justify-end bg-black/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="vc-glass max-h-full w-[340px] overflow-y-auto p-4"
            initial={{ x: 360 }} animate={{ x: 0 }} exit={{ x: 360 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-accent">Theme Editor</h2>
              <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>

            {/* presets */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setTheme(p)}
                  className={`rounded-lg border p-2 text-left text-xs font-semibold transition ${
                    theme.name === p.name ? "border-accent" : "border-white/10 hover:border-white/30"
                  }`}
                  style={{ background: p.bg }}
                >
                  <div className="mb-1.5 flex gap-1">
                    {[p.accent, p.accent2, p.text].map((c) => (
                      <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <span style={{ color: p.text }}>{p.name}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <ColorRow label="Background" value={theme.bg} onChange={(v) => patch({ bg: v })} />
              <ColorRow label="Accent (neon)" value={theme.accent} onChange={(v) => patch({ accent: v })} />
              <ColorRow label="Accent 2" value={theme.accent2} onChange={(v) => patch({ accent2: v })} />
              <ColorRow label="Text" value={theme.text} onChange={(v) => patch({ text: v })} />

              <Slider label="Glow intensity" min={0} max={1} step={0.05} value={theme.glow} onChange={(v) => patch({ glow: v })} />
              <Slider label="Corner radius" min={0} max={28} step={1} value={theme.radius} onChange={(v) => patch({ radius: v })} suffix="px" />

              <Field label="Font">
                <select
                  value={theme.font}
                  onChange={(e) => patch({ font: e.target.value as Theme["font"] })}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                >
                  {["Space Grotesk", "Inter", "JetBrains Mono"].map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </Field>

              <Field label="Message bubble">
                <div className="flex gap-1">
                  {(["glass", "flat", "outline"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => patch({ bubbleStyle: b })}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold capitalize transition ${
                        theme.bubbleStyle === b ? "border-accent text-accent" : "border-white/10 text-muted"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </Field>

              <ChipGrid
                label="Tile template"
                options={TILE_TEMPLATES}
                value={theme.tile ?? "glass"}
                onPick={(id) => patch({ tile: id as Theme["tile"] })}
              />
              <ChipGrid
                label="Button template"
                options={BTN_TEMPLATES}
                value={theme.btn ?? "solid"}
                onPick={(id) => patch({ btn: id as Theme["btn"] })}
              />
              <ChipGrid
                label="Button effect (hover)"
                options={BTN_EFFECTS}
                value={theme.btnFx ?? "none"}
                onPick={(id) => patch({ btnFx: id as Theme["btnFx"] })}
              />
              <ChipGrid
                label="Text template"
                options={TEXT_TEMPLATES}
                value={theme.textStyle ?? "default"}
                onPick={(id) => patch({ textStyle: id as Theme["textStyle"] })}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChipGrid({
  label, options, value, onPick,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-3 gap-1">
        {options.map(([id, name]) => (
          <button
            key={id}
            onClick={() => onPick(id)}
            className={`rounded-md border px-1.5 py-1.5 text-[11px] font-semibold transition ${
              value === id ? "border-accent text-accent" : "border-white/10 text-muted hover:border-white/30"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // color inputs need #rrggbb; strip rgba() surfaces gracefully.
  const hex = value.startsWith("#") ? value : "#141021";
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent" />
      </div>
    </Field>
  );
}

function Slider({ label, min, max, step, value, onChange, suffix }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <Field label={`${label} · ${value}${suffix ?? ""}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-[var(--vc-accent)]" />
    </Field>
  );
}
