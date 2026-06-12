import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ImagePlus, Loader2, Play, RotateCcw, SlidersHorizontal, Sparkles, Trash2, Upload, Wand2, X } from "lucide-react";
import type { OverlayCustomAnimation, OverlayCustomAsset, OverlayCustomEffect, OverlayEffectMotion, OverlayEffectProfile } from "@shared/types";
import { ENGAGE_ROOM, OVERLAY_ACTIONS, publishOverlayEvent } from "@/lib/overlayEngagement";
import { defaultOverlayEffectProfile } from "@/lib/overlayFx";
import { useOverlayStore } from "@/store/overlayStore";
import { useToastStore } from "@/store/toastStore";

const ANIMATIONS: { id: OverlayCustomAnimation; label: string }[] = [
  { id: "float", label: "Float" },
  { id: "orbit", label: "Orbit" },
  { id: "impact", label: "Impact" },
  { id: "scan", label: "Scan" },
  { id: "rain", label: "Rain" },
  { id: "pulse", label: "Pulse" },
  { id: "glitch", label: "Glitch" },
];

const EFFECTS: { id: OverlayCustomEffect; label: string }[] = [
  { id: "none", label: "Clean" },
  { id: "neon", label: "Neon" },
  { id: "hologram", label: "Holo" },
  { id: "ember", label: "Ember" },
  { id: "frost", label: "Frost" },
  { id: "gold", label: "Gold" },
];

const MOTIONS: { id: OverlayEffectMotion; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "slower", label: "Slower" },
  { id: "snappy", label: "Snappy" },
  { id: "cinematic", label: "Cinematic" },
  { id: "chaos", label: "Chaos" },
];

const COLORS = ["#16e6a4", "#34d6ff", "#d9a547", "#ff5c7a", "#a78bfa", "#f97316", "#f8fafc"];

export function OverlayFxLab({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const effectProfiles = useOverlayStore((s) => s.effectProfiles);
  const customAssets = useOverlayStore((s) => s.customAssets);
  const addCustomAsset = useOverlayStore((s) => s.addCustomAsset);
  const updateCustomAsset = useOverlayStore((s) => s.updateCustomAsset);
  const removeCustomAsset = useOverlayStore((s) => s.removeCustomAsset);
  const updateEffectProfile = useOverlayStore((s) => s.updateEffectProfile);
  const resetEffectProfile = useOverlayStore((s) => s.resetEffectProfile);
  const resetEffectProfiles = useOverlayStore((s) => s.resetEffectProfiles);
  const push = useToastStore((s) => s.push);
  const [selectedAction, setSelectedAction] = useState("charging-bull");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(customAssets[0]?.id ?? null);
  const [processing, setProcessing] = useState(false);
  const [threshold, setThreshold] = useState(42);
  const [feather, setFeather] = useState(22);
  const [tab, setTab] = useState<"builtins" | "custom">("builtins");

  const action = OVERLAY_ACTIONS.find((a) => a.id === selectedAction) ?? OVERLAY_ACTIONS[0];
  const profile = effectProfiles[action.id] ?? defaultOverlayEffectProfile(action.id);
  const asset = customAssets.find((a) => a.id === selectedAsset) ?? customAssets[0] ?? null;

  const actionGroups = useMemo(() => {
    const hero = OVERLAY_ACTIONS.filter((a) => ["charging-bull", "bear-slash", "chart-pump", "chart-dump"].includes(a.id));
    const emotes = OVERLAY_ACTIONS.filter((a) => a.kind === "emote");
    const utility = OVERLAY_ACTIONS.filter((a) => !hero.includes(a) && a.kind !== "emote" && a.kind !== "clear");
    return [
      { label: "Hero", actions: hero },
      { label: "Emote", actions: emotes },
      { label: "Utility", actions: utility },
    ];
  }, []);

  const patchProfile = (patch: Partial<OverlayEffectProfile>) => updateEffectProfile(action.id, patch);
  const patchAsset = (patch: Partial<OverlayCustomAsset>) => {
    if (!asset) return;
    updateCustomAsset(asset.id, patch);
  };

  const previewAction = () => {
    publishOverlayEvent({
      room: ENGAGE_ROOM,
      actionId: action.id,
      kind: action.kind,
      label: action.label,
      user: "FX Lab",
      cost: 0,
      payload: {
        side: action.id.includes("bear") || action.id.includes("dump") || action.id.includes("ngmi") ? "bear" : action.kind === "vote" ? "bull" : undefined,
        ticker: "MB",
        emote: action.id.includes("emote") || action.id.includes("meme") || action.id === "whale-storm" ? "FX LAB" : undefined,
        color: profile.accent ?? action.accent,
        message: "previewing the tuned overlay effect",
      },
    });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    try {
      const originalSrc = await readFile(file);
      const src = await cutoutToPng(originalSrc, threshold, feather);
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const next: OverlayCustomAsset = {
        id,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 32) || "Custom effect",
        src,
        originalSrc,
        animation: "impact",
        effect: "neon",
        accent: "#16e6a4",
        opacity: 1,
        intensity: 1,
        speed: 1,
        size: 260,
        threshold,
        feather,
        createdAt: Date.now(),
      };
      addCustomAsset(next);
      setSelectedAsset(next.id);
      setTab("custom");
      push({ message: "Custom transparent overlay asset added", tone: "ok" });
    } catch (error) {
      console.error(error);
      push({ message: "Could not process that image", tone: "error" });
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const rerunCutout = async () => {
    if (!asset?.originalSrc) return;
    setProcessing(true);
    try {
      const src = await cutoutToPng(asset.originalSrc, threshold, feather);
      updateCustomAsset(asset.id, { src, threshold, feather });
      push({ message: "Cutout rebuilt with new edge settings", tone: "ok" });
    } catch {
      push({ message: "Could not rebuild that cutout", tone: "error" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-[260] bg-black/62 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 10, filter: "blur(4px)" }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex h-[min(880px,calc(100vh-32px))] max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#070a09]/96 shadow-[0_30px_120px_rgba(0,0,0,0.78)]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#16e6a4]/35 bg-[#16e6a4]/12 text-[#16e6a4]">
            <Wand2 size={19} />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-[0.18em] text-[#16e6a4]">Overlay FX Lab</div>
            <div className="text-xs font-semibold text-white/48">Tune built-ins, build custom transparent PNG overlays, preview on the live layer.</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setTab("builtins")} className={tabButton(tab === "builtins")}><SlidersHorizontal size={14} /> Built-ins</button>
            <button onClick={() => setTab("custom")} className={tabButton(tab === "custom")}><ImagePlus size={14} /> Custom PNG</button>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-white/55 transition-[color,background-color] hover:bg-white/10 hover:text-white" title="Close FX Lab">
              <X size={18} />
            </button>
          </div>
        </header>

        {tab === "builtins" ? (
          <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] overflow-hidden">
            <aside className="min-h-0 overflow-y-auto border-r border-white/10 p-3">
              {actionGroups.map((group) => (
                <div key={group.label} className="mb-4">
                  <div className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/38">{group.label} effects</div>
                  <div className="space-y-1.5">
                    {group.actions.map((a) => {
                      const active = a.id === action.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAction(a.id)}
                          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-[background-color,color,box-shadow] ${
                            active ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]" : "text-white/58 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: effectProfiles[a.id]?.accent ?? a.accent }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </aside>

            <section className="min-h-0 overflow-y-auto p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-4 w-4 rounded-full shadow-[0_0_22px_currentColor]" style={{ color: profile.accent ?? action.accent, background: profile.accent ?? action.accent }} />
                      <div className="min-w-0">
                        <h2 className="text-2xl font-black leading-tight text-white">{action.label}</h2>
                        <p className="mt-1 text-sm font-medium leading-6 text-white/52">{action.description}</p>
                      </div>
                      <button onClick={previewAction} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-[#16e6a4] px-3 text-sm font-black text-black transition-[scale,filter] hover:brightness-110 active:scale-[0.96]">
                        <Play size={15} /> Preview
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Range label="Duration" value={profile.durationScale} min={0.45} max={2.4} step={0.05} onChange={(durationScale) => patchProfile({ durationScale })} suffix="x" />
                    <Range label="Intensity" value={profile.intensity} min={0} max={2} step={0.05} onChange={(intensity) => patchProfile({ intensity })} suffix="x" />
                    <Range label="Density" value={profile.density} min={0.2} max={2.2} step={0.05} onChange={(density) => patchProfile({ density })} suffix="x" />
                    <Range label="Scale" value={profile.scale} min={0.55} max={1.8} step={0.05} onChange={(scale) => patchProfile({ scale })} suffix="x" />
                    <Range label="Blur / Trails" value={profile.blur} min={0} max={1.8} step={0.05} onChange={(blur) => patchProfile({ blur })} suffix="x" />
                    <Range label="Audio" value={profile.audio} min={0} max={1.5} step={0.05} onChange={(audio) => patchProfile({ audio })} suffix="x" />
                  </div>

                  <Segmented label="Motion Flavor" value={profile.motion} values={MOTIONS} onChange={(motion) => patchProfile({ motion })} />
                  <ColorSwatches label="Accent Override" value={profile.accent ?? action.accent} onChange={(accent) => patchProfile({ accent })} />

                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => resetEffectProfile(action.id)} className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-sm font-bold text-white/70 transition-[background-color,color] hover:bg-white/8 hover:text-white">
                      <RotateCcw size={15} /> Reset this effect
                    </button>
                    <button onClick={resetEffectProfiles} className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-sm font-bold text-red-200 transition-[background-color] hover:bg-red-500/10">
                      <RotateCcw size={15} /> Reset all built-ins
                    </button>
                  </div>
                </div>

                <ProfilePreview action={action} profile={profile} />
              </div>
            </section>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] overflow-hidden">
            <aside className="min-h-0 overflow-y-auto border-r border-white/10 p-3">
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleUpload(e.target.files?.[0])} />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={processing}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#16e6a4]/35 bg-[#16e6a4]/12 px-4 py-4 text-sm font-black text-[#16e6a4] transition-[scale,filter] hover:brightness-110 active:scale-[0.96] disabled:opacity-60"
              >
                {processing ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />} Upload and cut out
              </button>
              <div className="space-y-1.5">
                {customAssets.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAsset(a.id)}
                    className={`flex w-full items-center gap-2 rounded-xl p-2 text-left transition-[background-color,color] ${asset?.id === a.id ? "bg-white/10 text-white" : "text-white/58 hover:bg-white/[0.06] hover:text-white"}`}
                  >
                    <img src={a.src} alt="" className="h-10 w-10 rounded-lg bg-black/32 object-contain" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{a.name}</span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="min-h-0 overflow-y-auto p-5">
              {asset ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">Asset name</span>
                        <input value={asset.name} onChange={(e) => patchAsset({ name: e.target.value })} className="mt-1 w-full bg-transparent text-2xl font-black text-white outline-none" />
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Range label="Size" value={asset.size} min={90} max={620} step={10} onChange={(size) => patchAsset({ size })} suffix="px" />
                      <Range label="Opacity" value={asset.opacity} min={0.15} max={1} step={0.01} onChange={(opacity) => patchAsset({ opacity })} />
                      <Range label="Intensity" value={asset.intensity} min={0} max={2} step={0.05} onChange={(intensity) => patchAsset({ intensity })} suffix="x" />
                      <Range label="Speed" value={asset.speed} min={0.35} max={2.4} step={0.05} onChange={(speed) => patchAsset({ speed })} suffix="x" />
                      <Range label="Background Threshold" value={threshold} min={10} max={110} step={1} onChange={setThreshold} />
                      <Range label="Feather" value={feather} min={0} max={60} step={1} onChange={setFeather} />
                    </div>

                    <Segmented label="Animation" value={asset.animation} values={ANIMATIONS} onChange={(animation) => patchAsset({ animation })} />
                    <Segmented label="Effect Finish" value={asset.effect} values={EFFECTS} onChange={(effect) => patchAsset({ effect })} />
                    <ColorSwatches label="Glow Accent" value={asset.accent} onChange={(accent) => patchAsset({ accent })} />

                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={rerunCutout} disabled={processing || !asset.originalSrc} className="inline-flex items-center gap-2 rounded-xl border border-[#16e6a4]/35 px-3 py-2 text-sm font-bold text-[#16e6a4] transition-[background-color] hover:bg-[#16e6a4]/10 disabled:opacity-50">
                        {processing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Rebuild cutout
                      </button>
                      <button onClick={() => removeCustomAsset(asset.id)} className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-sm font-bold text-red-200 transition-[background-color] hover:bg-red-500/10">
                        <Trash2 size={15} /> Remove asset
                      </button>
                    </div>
                  </div>

                  <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(22,230,164,0.14),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:32px_32px]" />
                    <div className="relative grid h-full min-h-[370px] place-items-center">
                      <motion.img
                        src={asset.src}
                        alt={asset.name}
                        draggable={false}
                        className="max-h-[320px] max-w-[280px] object-contain drop-shadow-[0_24px_36px_rgba(0,0,0,0.58)]"
                        animate={{ y: [0, -10, 0], rotate: [-2, 2, -2], scale: [1, 1.04, 1] }}
                        transition={{ duration: 2.2 / Math.max(0.35, asset.speed), repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid h-full min-h-[420px] place-items-center rounded-2xl border border-dashed border-white/14 bg-white/[0.025] text-center">
                  <div>
                    <ImagePlus size={38} className="mx-auto text-white/34" />
                    <div className="mt-3 text-xl font-black text-white">Upload an image to create a custom overlay asset.</div>
                    <div className="mt-1 text-sm font-medium text-white/48">The browser cutout pass turns edge-matched backgrounds transparent and stores the PNG locally.</div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Range({ label, value, min, max, step, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.15em] text-white/42">
        {label}
        <b className="font-black text-white/78">{value.toFixed(step < 1 ? 2 : 0)}{suffix}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-[#16e6a4]" />
    </label>
  );
}

function Segmented<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/42">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((item) => (
          <button key={item.id} onClick={() => onChange(item.id)} className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition-[background-color,color] ${value === item.id ? "bg-[#16e6a4] text-black" : "bg-white/[0.06] text-white/60 hover:text-white"}`}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorSwatches({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/42">{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className="h-8 w-8 rounded-full border transition-[scale,box-shadow] active:scale-[0.96]"
            style={{ background: color, borderColor: value === color ? "#fff" : "rgba(255,255,255,0.18)", boxShadow: value === color ? `0 0 18px ${color}` : "none" }}
            title={color}
          />
        ))}
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-28 rounded-lg border border-white/10 bg-black/24 px-2 text-xs font-bold text-white outline-none" />
      </div>
    </div>
  );
}

function ProfilePreview({ action, profile }: { action: { label: string; accent: string }; profile: OverlayEffectProfile }) {
  const accent = profile.accent ?? action.accent;
  return (
    <div className="relative min-h-[380px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_42%,rgba(22,230,164,0.14),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <motion.div
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: accent }}
        animate={{ opacity: [0.16, 0.42 * profile.intensity, 0.16], scale: [0.8, profile.scale * 1.22, 0.8] }}
        transition={{ duration: 2.2 * profile.durationScale, repeat: Infinity, ease: "easeInOut" }}
      />
      {Array.from({ length: Math.max(6, Math.round(18 * profile.density)) }, (_, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-14 rounded-full"
          style={{ left: `${8 + ((i * 13) % 82)}%`, top: `${18 + ((i * 19) % 68)}%`, background: `linear-gradient(90deg,transparent,${accent},#fff,transparent)`, boxShadow: `0 0 14px ${accent}` }}
          animate={{ opacity: [0, profile.intensity, 0], x: [i % 2 ? -32 : 32, i % 2 ? 32 : -32], scaleX: [0.4, 1.25, 0.5] }}
          transition={{ duration: 1.2 * profile.durationScale, delay: i * 0.035, repeat: Infinity, repeatDelay: 1.2, ease: "easeOut" }}
        />
      ))}
      <div className="relative grid h-full min-h-[330px] place-items-center">
        <motion.div
          className="rounded-2xl border px-5 py-4 text-center shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
          style={{ borderColor: `${accent}66`, background: `linear-gradient(135deg, ${accent}22, rgba(0,0,0,0.62))`, filter: `blur(${profile.blur * 0.15}px)` }}
          animate={{ scale: [0.92, profile.scale, 0.96], rotate: [-2, 2, -1], y: [12, -10, 4] }}
          transition={{ duration: 1.8 * profile.durationScale, repeat: Infinity, repeatDelay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>{profile.motion}</div>
          <div className="mt-1 text-xl font-black uppercase tracking-[0.08em] text-white">{action.label}</div>
        </motion.div>
      </div>
    </div>
  );
}

function tabButton(active: boolean): string {
  return `inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black transition-[background-color,color] ${active ? "bg-white text-black" : "bg-white/[0.06] text-white/62 hover:text-white"}`;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function cutoutToPng(src: string, threshold: number, feather: number): Promise<string> {
  const image = await loadImage(src);
  const max = 900;
  const ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(image, 0, 0, width, height);
  const frame = ctx.getImageData(0, 0, width, height);
  const data = frame.data;
  const bg = sampleEdgeColor(data, width, height);
  const soft = Math.max(1, feather);
  for (let i = 0; i < data.length; i += 4) {
    const d = colorDistance(data[i], data[i + 1], data[i + 2], bg[0], bg[1], bg[2]);
    if (d < threshold) {
      data[i + 3] = 0;
    } else if (d < threshold + soft) {
      const alpha = (d - threshold) / soft;
      data[i + 3] = Math.round(data[i + 3] * alpha);
    }
  }
  ctx.putImageData(frame, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

function sampleEdgeColor(data: Uint8ClampedArray, width: number, height: number): [number, number, number] {
  const samples: [number, number, number][] = [];
  const step = Math.max(2, Math.floor(Math.min(width, height) / 48));
  for (let x = 0; x < width; x += step) {
    samples.push(pixel(data, width, x, 0), pixel(data, width, x, height - 1));
  }
  for (let y = 0; y < height; y += step) {
    samples.push(pixel(data, width, 0, y), pixel(data, width, width - 1, y));
  }
  samples.sort((a, b) => luminance(a) - luminance(b));
  const mid = samples.slice(Math.floor(samples.length * 0.18), Math.ceil(samples.length * 0.82));
  const n = Math.max(1, mid.length);
  const sum = mid.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]] as [number, number, number], [0, 0, 0]);
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): [number, number, number] {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

function luminance([r, g, b]: [number, number, number]): number {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr * 0.8 + dg * dg * 1.1 + db * db * 0.8);
}
