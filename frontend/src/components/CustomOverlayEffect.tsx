import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { OverlayCustomAsset, OverlayElement } from "@shared/types";

const FX_STYLE: Record<OverlayCustomAsset["effect"], { filter: string; shadow: string; aura: string }> = {
  none: { filter: "drop-shadow(0 16px 28px rgba(0,0,0,0.48))", shadow: "rgba(0,0,0,0.4)", aura: "transparent" },
  neon: { filter: "saturate(1.2) contrast(1.08)", shadow: "var(--asset-accent)", aura: "var(--asset-accent)" },
  hologram: { filter: "saturate(1.35) contrast(1.08) hue-rotate(8deg)", shadow: "#34d6ff", aura: "#34d6ff" },
  ember: { filter: "saturate(1.25) contrast(1.1) sepia(0.12)", shadow: "#f97316", aura: "#f97316" },
  frost: { filter: "saturate(0.9) contrast(1.08) brightness(1.08)", shadow: "#93e8ff", aura: "#93e8ff" },
  gold: { filter: "saturate(1.18) contrast(1.08) sepia(0.28)", shadow: "#d9a547", aura: "#d9a547" },
};

export function CustomOverlayEffect({ el, editing = false }: { el: OverlayElement; editing?: boolean }) {
  if (!el.custom) return null;
  const asset = el.custom;
  const fx = FX_STYLE[asset.effect] ?? FX_STYLE.none;
  const size = el.w ?? asset.size;
  const speed = Math.max(0.35, asset.speed);
  const intensity = Math.max(0, asset.intensity);
  const accent = asset.accent || "#16e6a4";
  const wrapper = animationFor(asset, speed);
  const style = {
    "--asset-accent": accent,
    width: size,
    height: el.h ?? size,
    opacity: asset.opacity,
    transform: `scale(${el.scale})`,
    transformOrigin: "top left",
  } as CSSProperties;

  return (
    <motion.div
      className="relative grid select-none place-items-center"
      style={style}
      initial={wrapper.initial}
      animate={editing ? wrapper.editingAnimate : wrapper.animate}
      transition={wrapper.transition}
    >
      <CustomAura asset={asset} accent={accent} fx={fx} intensity={intensity} />
      <motion.img
        src={asset.src}
        alt={asset.name}
        draggable={false}
        className="relative z-10 block h-full w-full object-contain"
        style={{
          filter: `${fx.filter} drop-shadow(0 16px 28px rgba(0,0,0,0.52)) drop-shadow(0 0 ${Math.round(24 * intensity)}px ${fx.shadow})`,
          willChange: "transform, opacity, filter",
        }}
      />
      {asset.effect === "hologram" && <HologramScan accent={accent} speed={speed} />}
      {asset.effect === "ember" && <ParticleHalo asset={asset} mode="ember" />}
      {asset.effect === "frost" && <ParticleHalo asset={asset} mode="frost" />}
      {asset.effect === "gold" && <ParticleHalo asset={asset} mode="gold" />}
    </motion.div>
  );
}

function CustomAura({ asset, accent, fx, intensity }: { asset: OverlayCustomAsset; accent: string; fx: { aura: string }; intensity: number }) {
  if (asset.effect === "none" || intensity <= 0.05) return null;
  return (
    <motion.span
      className="absolute inset-[-18%] z-0 rounded-full blur-2xl"
      style={{ background: `radial-gradient(circle at 50% 50%, ${fx.aura === "var(--asset-accent)" ? accent : fx.aura}66, transparent 62%)` }}
      animate={{ opacity: [0.18 * intensity, 0.42 * intensity, 0.18 * intensity], scale: [0.92, 1.08, 0.92] }}
      transition={{ duration: 2.4 / Math.max(0.45, asset.speed), repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function HologramScan({ accent, speed }: { accent: string; speed: number }) {
  return (
    <>
      <motion.span
        className="pointer-events-none absolute inset-x-0 z-20 h-[18%] bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.36),transparent)] mix-blend-screen"
        animate={{ y: ["-80%", "560%"], opacity: [0, 0.75, 0] }}
        transition={{ duration: 1.8 / speed, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        className="pointer-events-none absolute inset-0 z-20 opacity-30 mix-blend-screen"
        style={{ backgroundImage: `repeating-linear-gradient(180deg, ${accent}55 0 1px, transparent 1px 7px)` }}
      />
    </>
  );
}

function ParticleHalo({ asset, mode }: { asset: OverlayCustomAsset; mode: "ember" | "frost" | "gold" }) {
  const color = mode === "ember" ? "#f97316" : mode === "frost" ? "#93e8ff" : "#d9a547";
  const count = Math.max(4, Math.round(10 * asset.intensity));
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <motion.span
          key={`${asset.id}-${mode}-${i}`}
          className="absolute z-0 h-1.5 w-1.5 rounded-full"
          style={{
            left: `${12 + ((i * 17) % 76)}%`,
            top: `${18 + ((i * 23) % 66)}%`,
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
          animate={{ opacity: [0, 0.85, 0], x: [(i % 2 ? -1 : 1) * 8, (i % 2 ? 1 : -1) * 16], y: [8, -24 - (i % 5) * 8], scale: [0.4, 1, 0.2] }}
          transition={{ duration: (1.8 + (i % 4) * 0.18) / Math.max(0.45, asset.speed), delay: i * 0.08, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

function animationFor(asset: OverlayCustomAsset, speed: number) {
  const duration = (base: number) => base / speed;
  switch (asset.animation) {
    case "orbit":
      return {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, x: [0, 18, 0, -18, 0], y: [0, -10, -20, -10, 0], rotate: [-4, 3, -2, 4, -4] },
        editingAnimate: { opacity: 1, y: [0, -4, 0] },
        transition: { duration: duration(5.2), repeat: Infinity, ease: "easeInOut" },
      };
    case "impact":
      return {
        initial: { opacity: 0, scale: 0.35, filter: "blur(8px)" },
        animate: { opacity: [0, 1, 0.96, 1], scale: [0.35, 1.18, 0.98, 1.05], rotate: [-10, 4, -2, 0], filter: ["blur(8px)", "blur(0px)", "blur(0px)", "blur(0px)"] },
        editingAnimate: { opacity: 1, scale: [0.96, 1.04, 0.96] },
        transition: { duration: duration(1.45), repeat: Infinity, repeatDelay: duration(2.2), ease: [0.16, 1, 0.3, 1] },
      };
    case "scan":
      return {
        initial: { opacity: 0, x: "-20vw", scale: 0.92 },
        animate: { opacity: [0, 1, 1, 0], x: ["-20vw", "0vw", "8vw", "34vw"], scale: [0.92, 1, 1.02, 0.96] },
        editingAnimate: { opacity: 1, x: [0, 7, 0] },
        transition: { duration: duration(3.8), repeat: Infinity, repeatDelay: duration(0.9), ease: [0.16, 1, 0.3, 1] },
      };
    case "rain":
      return {
        initial: { opacity: 0, y: "-12vh", rotate: -8 },
        animate: { opacity: [0, 1, 1, 0], y: ["-12vh", "24vh", "72vh", "112vh"], rotate: [-8, 5, -3, 12] },
        editingAnimate: { opacity: 1, y: [0, 8, 0] },
        transition: { duration: duration(4.2), repeat: Infinity, ease: "linear" },
      };
    case "pulse":
      return {
        initial: { opacity: 0, scale: 0.88 },
        animate: { opacity: 1, scale: [0.94, 1.08, 0.94], rotate: [-1, 1, -1] },
        editingAnimate: { opacity: 1, scale: [0.98, 1.04, 0.98] },
        transition: { duration: duration(1.8), repeat: Infinity, ease: "easeInOut" },
      };
    case "glitch":
      return {
        initial: { opacity: 0, scale: 1 },
        animate: { opacity: [0, 1, 1, 0.9, 1], x: [0, -5, 4, -2, 0], y: [0, 2, -2, 1, 0], skewX: [0, -5, 6, -2, 0] },
        editingAnimate: { opacity: 1, x: [0, -2, 2, 0] },
        transition: { duration: duration(0.42), repeat: Infinity, repeatDelay: duration(1.4), ease: "easeInOut" },
      };
    case "float":
    default:
      return {
        initial: { opacity: 0, y: 12, scale: 0.96 },
        animate: { opacity: 1, y: [0, -14, 0], rotate: [-2, 2, -2], scale: [1, 1.03, 1] },
        editingAnimate: { opacity: 1, y: [0, -5, 0] },
        transition: { duration: duration(3.2), repeat: Infinity, ease: "easeInOut" },
      };
  }
}
