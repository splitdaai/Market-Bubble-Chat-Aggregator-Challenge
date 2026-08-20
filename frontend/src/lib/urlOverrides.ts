import type { Account, Platform } from "@shared/types";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useOverlayStore } from "@/store/overlayStore";
import { useLiveSourcesStore } from "@/store/liveSourcesStore";
import { useModeStore } from "@/store/modeStore";

/**
 * Carry the operator's channel setup INTO OBS pop-outs via the URL.
 *
 * The dashboard, the browser pop-out and OBS Browser Sources / Docks are all
 * the same web app, but OBS has its own cookie jar & localStorage — so the
 * channels you added in Connections don't exist there. Every OBS URL the app
 * hands out therefore embeds them:
 *
 *   ?dock=1&mode=live&ch=twitch:eddie,kick:eddie,youtube:@eddie,xbid:1kKzDDrlpOXJv
 *
 * `applyUrlOverrides()` runs once at boot (before React) and, when `ch=` is
 * present, REPLACES that page's account list + X broadcast with the URL's, and
 * `mode=` pins Demo/Live. Kick room ids ride along as `kickroom:<slug>=<id>`.
 */
const PLATFORMS: Platform[] = ["twitch", "kick", "x", "youtube"];

export function channelsParam(accounts: Account[], xBroadcastId: string, kickRooms: Record<string, string>): string {
  const parts: string[] = [];
  for (const a of accounts) {
    if (!a.connected) continue;
    parts.push(`${a.platform}:${a.handle}`);
    if (a.platform === "kick") {
      const room = kickRooms[a.handle.replace(/^[@#]/, "").toLowerCase()];
      if (room) parts.push(`kickroom:${a.handle.replace(/^[@#]/, "").toLowerCase()}=${room}`);
    }
  }
  if (xBroadcastId) parts.push(`xbid:${xBroadcastId}`);
  return parts.join(",");
}

/** Build an OBS-ready URL for a route (`dock` | `broadcast` | `overlay`), pinned to LIVE + current channels. */
export function obsUrl(route: "dock" | "broadcast" | "overlay", extra: Record<string, string> = {}): string {
  if (typeof window === "undefined") return "";
  const { accounts } = useConnectionsStore.getState();
  const { xBroadcastId, kickRooms } = useLiveSourcesStore.getState();
  const p = new URLSearchParams({ [route]: "1", mode: "live", ...(route === "overlay" ? { show: "chat", qr: "0" } : {}), ...extra });
  const ch = channelsParam(accounts, xBroadcastId, kickRooms);
  if (ch) p.set("ch", ch);
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}

/** Parse `ch=` back into accounts / X broadcast / Kick rooms. Exported for tests. */
export function parseChannelsParam(raw: string): { accounts: Account[]; xBroadcastId?: string; kickRooms: Record<string, string> } {
  const accounts: Account[] = [];
  const kickRooms: Record<string, string> = {};
  let xBroadcastId: string | undefined;
  for (const part of raw.split(",")) {
    const i = part.indexOf(":");
    if (i <= 0) continue;
    const key = part.slice(0, i).toLowerCase();
    const val = part.slice(i + 1).trim();
    if (!val) continue;
    if (key === "xbid") { if (/^[A-Za-z0-9]{6,32}$/.test(val)) xBroadcastId = val; continue; }
    if (key === "kickroom") { const [slug, room] = val.split("="); if (slug && /^\d+$/.test(room ?? "")) kickRooms[slug.toLowerCase()] = room; continue; }
    if (!(PLATFORMS as string[]).includes(key)) continue;
    const platform = key as Platform;
    const handle = val.slice(0, 40).replace(/[^\w.@-]/g, "");
    if (!handle) continue;
    const id = `${platform}:${handle.replace(/^@/, "").toLowerCase()}`;
    if (accounts.some((a) => a.id === id)) continue;
    accounts.push({ id, platform, handle, displayName: handle.replace(/^@/, ""), connected: true });
  }
  return { accounts, xBroadcastId, kickRooms };
}

/** `show=chat` on an overlay URL → EXACTLY those overlay elements are visible
 *  and everything else is hidden (an OBS browser has fresh storage, where the
 *  combined viewer badge is on by default — a chat-only overlay must drop it). */
function applyShowParam(raw: string, label: boolean): void {
  const want = new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (!want.size) return;
  useOverlayStore.setState((s) => ({
    enabled: true,
    // URL-driven overlays are for compositing on a stream — no "Live Chat"
    // header chrome unless the URL opts back in with `label=1`.
    elements: s.elements.map((e) => ({ ...e, visible: want.has(e.source as string), showLabel: label })),
  }));
}

/** Boot-time: apply `mode=`, `ch=` and `show=` from the current URL to the stores. */
export function applyUrlOverrides(search = typeof window !== "undefined" ? window.location.search : ""): void {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  if (mode === "live") useModeStore.getState().setDemo(false);
  else if (mode === "demo") useModeStore.getState().setDemo(true);
  const show = params.get("show");
  if (show) applyShowParam(show, params.get("label") === "1");
  const ch = params.get("ch");
  if (!ch) return;
  const parsed = parseChannelsParam(ch);
  if (parsed.accounts.length) useConnectionsStore.getState().setAccounts(parsed.accounts);
  const live = useLiveSourcesStore.getState();
  if (parsed.xBroadcastId) live.setXBroadcast(parsed.xBroadcastId);
  for (const [slug, room] of Object.entries(parsed.kickRooms)) live.setKickRoom(slug, room);
}
