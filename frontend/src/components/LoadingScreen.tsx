import { useEffect, useState } from "react";
import { LOGO_SVG } from "@/lib/logoSvg";

/**
 * Boot loading screen — the real Market Bubble logo shown static in white, with
 * only the chart/pulse line drawing on from the left along its own path (then
 * filling solid). Then the overlay fades into the app. Shown once per load.
 * `?loaderhold` keeps it up for previewing.
 */
export function LoadingScreen() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("loaderhold")) return;
    const t1 = setTimeout(() => setPhase("out"), 1350);
    const t2 = setTimeout(() => setPhase("gone"), 1850);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (phase === "gone") return null;

  return (
    <div className={`mb-loader fixed inset-0 z-[200] grid place-items-center bg-[var(--vc-bg)] transition-opacity duration-500 ${phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <div className="vc-aurora absolute inset-0" />
      <div className="mb-logo-draw relative" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
    </div>
  );
}
