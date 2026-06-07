import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
// Grid base styles must load before our themed overrides in index.css.
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./index.css";
import "./mb-theme.css";
import { applyTheme } from "./lib/theme";
import { useThemeStore } from "./store/themeStore";

// A new deploy changes chunk hashes, so a tab opened before the deploy requests
// an old chunk that no longer exists → blank screen when it lazy-loads a view
// (e.g. Clips). Auto-recover by reloading once to fetch the fresh index.
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  const last = Number(sessionStorage.getItem("vc-chunk-reload") || 0);
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem("vc-chunk-reload", String(Date.now()));
    window.location.reload();
  }
});

// Apply the active theme (default or persisted) on first paint — guarantees the
// theme + style templates are set on the root before anything renders.
applyTheme(useThemeStore.getState().theme);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
