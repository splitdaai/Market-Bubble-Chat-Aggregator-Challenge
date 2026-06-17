import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "@shared/types";
import { DEFAULT_THEME, applyTheme } from "@/lib/theme";

/** Market-page layout template: our Bubble layout vs the Classic reference clone. */
export type MarketTemplate = "bubble" | "classic";

interface ThemeState {
  theme: Theme;
  soundEnabled: boolean;
  marketTemplate: MarketTemplate;
  setTheme: (t: Theme) => void;
  patch: (p: Partial<Theme>) => void;
  toggleSound: () => void;
  setMarketTemplate: (t: MarketTemplate) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      soundEnabled: false,
      marketTemplate: "classic",
      setMarketTemplate: (marketTemplate) => set({ marketTemplate }),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      patch: (p) =>
        set((s) => {
          const theme = { ...s.theme, ...p };
          applyTheme(theme);
          return { theme };
        }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
    }),
    {
      name: "vibechat-theme-mb-v6",
      onRehydrateStorage: () => (state) => {
        // Re-apply persisted theme to :root once hydrated from localStorage.
        applyTheme(state?.theme ?? DEFAULT_THEME);
      },
    },
  ),
);

// Apply the active theme on first paint (covers fresh visitors with no persisted
// theme — so the default theme + style templates are set before hydration too).
if (typeof document !== "undefined") {
  applyTheme(useThemeStore.getState().theme);
}
