import type { Theme } from "@shared/types";

/** The Market Bubble brand theme — bull-market mint + cyan, bubbly + glowy. */
export const MARKET_BUBBLE_THEME: Theme = {
  name: "Market Bubble",
  bg: "#04100c",
  surface: "rgba(9, 27, 21, 0.66)",
  accent: "#16e6a4",
  accent2: "#34d6ff",
  text: "#eafff6",
  textMuted: "#78b6a4",
  glow: 0.82,
  radius: 22,
  font: "Space Grotesk",
  bubbleStyle: "glass",
};

/** The original cyber theme, kept as a preset. */
export const NEON_VOID_THEME: Theme = {
  name: "Neon Void",
  bg: "#07060d",
  surface: "rgba(18, 16, 33, 0.66)",
  accent: "#b14dff",
  accent2: "#2dd4ff",
  text: "#f3f0ff",
  textMuted: "#9a93c2",
  glow: 0.7,
  radius: 18,
  font: "Space Grotesk",
  bubbleStyle: "glass",
};

/** Mono Terminal — the shipped default: black bg, electric-blue accent, purple
 *  secondary, max glow, sharp 6px corners, JetBrains Mono, outline bubbles. */
export const MONO_TERMINAL_THEME: Theme = {
  name: "Mono Terminal",
  bg: "#0a0a0a",
  surface: "rgba(20, 20, 20, 0.72)",
  accent: "#00aaff",
  accent2: "#9146ff",
  text: "#f5f5f5",
  textMuted: "#888888",
  glow: 1,
  radius: 6,
  font: "JetBrains Mono",
  bubbleStyle: "outline",
};

/** Active default theme. */
export const DEFAULT_THEME: Theme = MONO_TERMINAL_THEME;

/** Terminal Pro — dense Bloomberg-style: mono everywhere, sharp corners,
 *  hairline borders, electric blue, minimal glow. */
export const TERMINAL_PRO_THEME: Theme = {
  name: "Terminal Pro",
  bg: "#060608",
  surface: "rgba(14, 14, 18, 0.88)",
  accent: "#00aaff",
  accent2: "#7c5cff",
  text: "#f2f4f7",
  textMuted: "#7f8693",
  glow: 0.28,
  radius: 7,
  font: "JetBrains Mono",
  bubbleStyle: "outline",
};

/** Glass Aurora — soft modern-SaaS glassmorphism: translucent panels, aurora
 *  glow, generous rounded corners, Inter. */
export const GLASS_AURORA_THEME: Theme = {
  name: "Glass Aurora",
  bg: "#070b14",
  surface: "rgba(18, 24, 38, 0.66)",
  accent: "#38bdf8",
  accent2: "#a78bfa",
  text: "#eef3fb",
  textMuted: "#93a0b8",
  glow: 0.72,
  radius: 18,
  font: "Inter",
  bubbleStyle: "glass",
};

/** Neon Bubble — Market Bubble brand: mint + cyan on deep green-black, bubbly
 *  rounded corners, neon glow, Space Grotesk. */
export const NEON_BUBBLE_THEME: Theme = {
  name: "Neon Bubble",
  bg: "#04100c",
  surface: "rgba(9, 27, 21, 0.6)",
  accent: "#16e6a4",
  accent2: "#34d6ff",
  text: "#eafff6",
  textMuted: "#78b6a4",
  glow: 0.85,
  radius: 16,
  font: "Space Grotesk",
  bubbleStyle: "glass",
};

/** Market Bubble Green — the green + Playfair-serif look from the Market/Content
 *  pages, as a full-app preset: flat cards, off-white text, low glow. */
export const MARKET_BUBBLE_GREEN_THEME: Theme = {
  name: "Market Bubble Green",
  bg: "#0f0f0f",
  surface: "#181818",
  accent: "#00d872",
  accent2: "#ff4b16",
  text: "#e4e4e4",
  textMuted: "#8a8a8a",
  glow: 0.18,
  radius: 14,
  font: "Geist",
  bubbleStyle: "flat",
  tile: "flat",
  btn: "solid",
  textStyle: "serif",
};

export const THEME_PRESETS: Theme[] = [
  MONO_TERMINAL_THEME,
  MARKET_BUBBLE_GREEN_THEME,
  TERMINAL_PRO_THEME,
  GLASS_AURORA_THEME,
  NEON_BUBBLE_THEME,
  MARKET_BUBBLE_THEME,
  NEON_VOID_THEME,
  {
    name: "Toxic Kick",
    bg: "#040a05",
    surface: "rgba(10, 26, 14, 0.62)",
    accent: "#53fc18",
    accent2: "#b6ff00",
    text: "#eafff0",
    textMuted: "#7fcf93",
    glow: 0.85,
    radius: 14,
    font: "Space Grotesk",
    bubbleStyle: "glass",
  },
  {
    name: "Ice Stream",
    bg: "#040810",
    surface: "rgba(12, 22, 40, 0.6)",
    accent: "#2dd4ff",
    accent2: "#7c9bff",
    text: "#eaf4ff",
    textMuted: "#8aa6c8",
    glow: 0.6,
    radius: 22,
    font: "Inter",
    bubbleStyle: "glass",
  },
];

/** Convert a "#rrggbb" string to an "r, g, b" triplet for rgba() vars. */
function hexToRgb(hex: string): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/** Read the live accent color off :root (resolved hex, for canvas/particles). */
export function accentColor(): string {
  if (typeof document === "undefined") return DEFAULT_THEME.accent;
  return getComputedStyle(document.documentElement).getPropertyValue("--vc-accent").trim() || DEFAULT_THEME.accent;
}

/** Write a Theme onto :root so every CSS var-driven style updates instantly. */
export function applyTheme(theme: Theme): void {
  const r = document.documentElement;
  r.style.setProperty("--vc-bg", theme.bg);
  r.style.setProperty("--vc-surface", theme.surface);
  r.style.setProperty("--vc-accent", theme.accent);
  r.style.setProperty("--vc-accent-rgb", hexToRgb(theme.accent));
  r.style.setProperty("--vc-accent2", theme.accent2);
  r.style.setProperty("--vc-text", theme.text);
  r.style.setProperty("--vc-text-muted", theme.textMuted);
  r.style.setProperty("--vc-glow", String(theme.glow));
  r.style.setProperty("--vc-radius", `${theme.radius}px`);
  r.style.setProperty("--vc-font", `"${theme.font}"`);
  // Style templates → data attributes consumed by index.css.
  r.setAttribute("data-tile", theme.tile ?? "glass");
  r.setAttribute("data-btn", theme.btn ?? "solid");
  r.setAttribute("data-btn-fx", theme.btnFx ?? "none");
  r.setAttribute("data-text", theme.textStyle ?? "default");
}

/** Selectable templates for the Theme Editor — [id, label]. */
export const TILE_TEMPLATES = [
  ["glass", "Glass"], ["flat", "Flat"], ["outline", "Outline"], ["elevated", "Elevated"],
  ["neon", "Neon Edge"], ["frosted", "Frosted"], ["inset", "Inset"], ["gradient", "Gradient"],
  ["holo", "Holographic"], ["line", "Line"],
] as const;
export const BTN_TEMPLATES = [
  ["solid", "Solid"], ["pill", "Pill"], ["soft", "Soft"], ["sharp", "Sharp"], ["square", "Square"],
  ["bold", "Bold"], ["caps", "Caps"], ["ring", "Ring"], ["glow", "Glow"], ["mono", "Mono"],
] as const;
export const TEXT_TEMPLATES = [
  ["default", "Default"], ["tight", "Tight"], ["wide", "Wide"], ["heavy", "Heavy"],
  ["light", "Light"], ["mono", "Mono"], ["soft", "Soft"], ["crisp", "Crisp"], ["serif", "Serif Heads"],
] as const;
/** Button hover/animation effects (DFM-style), layered on any button. */
export const BTN_EFFECTS = [
  ["none", "None"], ["lift", "Lift"], ["glow", "Glow"], ["halo", "Halo"],
  ["pop", "Pop"], ["press", "Press"], ["sheen", "Sheen"], ["sweep", "Sweep"],
  ["fill", "Fill"], ["pulse", "Pulse"], ["ring", "Ring"], ["underline", "Underline"],
  ["spin", "Spin"],
] as const;
