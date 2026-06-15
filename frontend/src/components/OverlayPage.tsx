import { useEffect, useMemo, useState } from "react";
import { useOverlayStore } from "@/store/overlayStore";
import { useModeStore } from "@/store/modeStore";
import { OverlayChip } from "./OverlayChip";
import { OverlayChat } from "./OverlayChat";
import { OverlayMarket } from "./OverlayMarket";
import { CustomOverlayEffect } from "./CustomOverlayEffect";
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

  // OBS injects `window.obsstudio` into browser sources. When it's ABSENT, this
  // page was opened directly in a normal browser — without a backdrop it reads as
  // a blank black void (everything here is transparent for chroma-free OBS
  // compositing). So in that case we paint a labelled preview backdrop. `?preview=0`
  // force-hides it; `?preview=1` force-shows it (handy for screenshots).
  const [previewMode, setPreviewMode] = useState(false);
  useEffect(() => {
    const force = params.get("preview");
    if (force === "0") return; // never paint the backdrop
    if (force === "1") {
      setPreviewMode(true); // force-show (screenshots / intentional preview)
      return;
    }
    const isObs = () => typeof (window as unknown as { obsstudio?: unknown }).obsstudio !== "undefined";
    if (isObs()) return;
    // OBS normally injects `window.obsstudio` BEFORE page scripts run, but the
    // injection can lag on slow/loaded machines. Painting the preview backdrop
    // inside a real OBS source would corrupt the live stream, so instead of a
    // single timed check we (a) poll across a generous window before committing
    // to preview mode, and (b) KEEP watching afterwards — if obsstudio ever
    // appears we immediately drop preview mode again.
    let elapsed = 0;
    const STEP = 200;
    const COMMIT_AFTER = 2500; // not OBS for 2.5s → safe to show the backdrop
    const GIVE_UP = 8000; // stop polling; no real OBS injects this late
    const id = window.setInterval(() => {
      if (isObs()) {
        setPreviewMode(false);
        window.clearInterval(id);
        return;
      }
      elapsed += STEP;
      if (elapsed >= COMMIT_AFTER) setPreviewMode(true);
      if (elapsed >= GIVE_UP) window.clearInterval(id);
    }, STEP);
    return () => window.clearInterval(id);
  }, [params]);

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
      {/* Preview-only backdrop + explainer (never rendered inside OBS). Keeps the
          actual overlay layers fully transparent so OBS compositing is unaffected. */}
      {previewMode && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% -10%, rgba(217,165,71,0.12), transparent 60%), linear-gradient(160deg, #0b0a08, #060504 70%)",
            }}
          />
          <div className="pointer-events-none absolute left-1/2 top-4 z-50 w-[min(640px,92vw)] -translate-x-1/2 rounded-2xl border border-[#d9a547]/30 bg-[#0b0a08]/90 px-4 py-3 text-center shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d9a547]">OBS Overlay Source</div>
            <div className="mt-1 text-[13px] font-semibold leading-snug text-white/85">
              This is the transparent browser-source for OBS — viewer badges, live vote meter, and crowd effects render on top of your stream.
            </div>
            <div className="mt-1 text-[11px] leading-snug text-white/55">
              Add this URL as a Browser Source in OBS for a see-through overlay. Scan the QR (bottom-right) to control it live.
            </div>
          </div>
        </>
      )}

      {elements.filter((el) => el.visible).map((el) => (
        <div key={el.id} className="absolute" style={{ left: el.x, top: el.y }}>
          {el.source === "chat" ? (
            <OverlayChat el={el} />
          ) : el.source === "market" ? (
            <OverlayMarket el={el} />
          ) : el.source === "custom" ? (
            <CustomOverlayEffect el={el} />
          ) : (
            <OverlayChip el={el} />
          )}
        </div>
      ))}

      {/* Remote-controlled viewer effects + scan-to-play QR — same engagement
          room as the broadcast panel, works in both live and demo. */}
      <OverlayEngagementLayer room={room} />
      {showQr && <EngagementQr room={room} />}
    </div>
  );
}
