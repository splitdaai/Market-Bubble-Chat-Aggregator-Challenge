import { useEffect } from "react";
import { useOverlayStore } from "@/store/overlayStore";
import { OverlayChip } from "./OverlayChip";
import { OverlayChat } from "./OverlayChat";
import { OverlayMarket } from "./OverlayMarket";

/**
 * Standalone OBS browser-source page (rendered for `?overlay=1`). Transparent
 * background, no chrome — just the viewer-count badges at their saved positions,
 * fed by the same live stats pipeline. Drop the URL into OBS as a Browser Source.
 */
export function OverlayPage() {
  const elements = useOverlayStore((s) => s.elements);

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
    </div>
  );
}
