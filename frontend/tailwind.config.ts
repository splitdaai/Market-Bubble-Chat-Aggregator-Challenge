import type { Config } from "tailwindcss";

/**
 * Theme tokens are intentionally CSS-variable-driven so the in-app Theme Editor
 * can mutate `:root` live without a rebuild. Tailwind utilities just reference
 * the vars.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--vc-bg)",
        surface: "var(--vc-surface)",
        accent: "var(--vc-accent)",
        accent2: "var(--vc-accent2)",
        ink: "var(--vc-text)",
        muted: "var(--vc-text-muted)",
        twitch: "#9146ff",
        x: "#e7e9ea",
        kick: "#53fc18",
      },
      fontFamily: {
        sans: ["var(--vc-font)", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neon: "0 0 calc(var(--vc-glow) * 24px) rgba(var(--vc-accent-rgb), calc(var(--vc-glow) * 0.6))",
      },
      keyframes: {
        "pop-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%,100%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.35)" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-glow": "pulse-glow 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
