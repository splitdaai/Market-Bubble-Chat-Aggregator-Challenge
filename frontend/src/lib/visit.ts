const BACKEND = import.meta.env.VITE_BACKEND_URL as string | undefined;

let sent = false;

/**
 * An anonymous, first-party visitor id kept in localStorage. It's just a random
 * value this browser remembers — no IP, no fingerprinting, no PII — so the owner
 * can count *unique* visitors without tracking anyone. Cleared if the user wipes
 * their site data.
 */
function visitorId(): string {
  try {
    const k = "mb_visitor_id";
    let id = localStorage.getItem(k);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

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
      body: JSON.stringify({ path: location.pathname + location.search, ref: document.referrer || undefined, vid: visitorId() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
