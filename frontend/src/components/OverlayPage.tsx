import { useEffect, useMemo } from "react";
import { useOverlayStore } from "@/store/overlayStore";
import { useModeStore } from "@/store/modeStore";
import { OverlayChip } from "./OverlayChip";
import { OverlayChat } from "./OverlayChat";
import { OverlayMarket } from "./OverlayMarket";
import { EngagementQr, OverlayEngagementLayer } from "./OverlayEngagementLayer";
import { ENGAGE_ROOM } from "@/lib/overlayEngagement";

/**
 * Standalone OBS browser-source page (rendered for `?overlay=1`). Transparent
 * background, no chrome — the viewer-count badges at their saved positions PLUS
 * the viewer-engagement layer (votes / emotes / boss / effects) and the
 * scan-to-play QR, so the remote-controlled effects work on this overlay route
 * exactly like they do on `?broadcast=1`.
 *
 * URL params:
 *   ?overlay=1        — renders this view
 *   &mode=live|demo   — pins the data mode (same as the broadcast route)
 *   &room=...         — engagement room (defaults to the shared ENGAGE_ROOM)
 *   &qr=0             — hide the scan-to-play QR
 */
export function OverlayPage() {
  const elements = useOverlayStore((s) => s.elements);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const room = params.get("room") || ENGAGE_ROOM;
  const showQr = params.get("qr") !== "0";

  // Pin the data mode on load so an OBS Browser Source isn't at the mercy of
  // whatever the Demo/Live toggle was last left on (mirrors the broadcast route).
  useEffect(() => {
    const m = params.get("mode");
    if (m === "live") useModeStore.getState().setDemo(false);
    else if (m === "demo") useModeStore.getState().setDemo(true);
  }, [params]);

  // Make the page background fully transparent for OBS chroma-free compositing.
  useEffect(() => {
    const prevBody = document.body.style.background;
    const prevHtml = document.documentElement.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = prevBody;
      document.documentElement.style.background = prevHtml;
    };
  }, []);

  return (
    <div className="fixed inset-0">
      {elements.filter((el) => el.visible).map((el) => (
        <div key={el.id} className="absolute" style={{ left: el.x, top: el.y }}>
          {el.source === "chat" ? <OverlayChat el={el} /> : el.source === "market" ? <OverlayMarket el={el} /> : <OverlayChip el={el} />}
        </div>
      ))}

      {/* Remote-controlled viewer effects + scan-to-play QR — same engagement
          room as the broadcast panel, works in both live and demo. */}
      <OverlayEngagementLayer room={room} />
      {showQr && <EngagementQr room={room} />}
    </div>
  );
}
