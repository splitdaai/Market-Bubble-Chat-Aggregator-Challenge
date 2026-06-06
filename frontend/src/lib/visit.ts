const BACKEND = import.meta.env.VITE_BACKEND_URL as string | undefined;

let sent = false;

/**
 * Fire-and-forget visit beacon. Pings the backend once per page load so it can
 * append a line to its (git-ignored) visitor log. No-ops without a backend URL
 * (local dev) and never throws. Skipped for the OBS overlay/dock embeds by the
 * caller, so only real page visits are counted.
 */
export function trackVisit(): void {
  if (sent || !BACKEND) return;
  sent = true;
  try {
    fetch(`${BACKEND}/api/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location.pathname + location.search, ref: document.referrer || undefined }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
