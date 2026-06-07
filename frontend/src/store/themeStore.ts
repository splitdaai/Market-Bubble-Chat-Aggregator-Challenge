import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "@shared/types";
import { DEFAULT_THEME, applyTheme } from "@/lib/theme";

interface ThemeState {
  theme: Theme;
  soundEnabled: boolean;
  setTheme: (t: Theme) => void;
  patch: (p: Partial<Theme>) => void;
  toggleSound: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      soundEnabled: false,
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
      name: "vibechat-theme-mb-v2",
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
