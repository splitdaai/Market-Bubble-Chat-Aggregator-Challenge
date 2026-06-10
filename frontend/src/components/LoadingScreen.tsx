import { useEffect, useState } from "react";
import { LOGO_SVG } from "@/lib/logoSvg";

/**
 * Boot loading screen — the REAL Market Bubble logo draws itself on (stroke
 * draw-on of the actual logo paths), then fills solid white, with a glow, then
 * the overlay fades into the app. Shown once per page load.
 * `?loaderhold` keeps it up for previewing.
 */
export function LoadingScreen() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("loaderhold")) return;
    const t1 = setTimeout(() => setPhase("out"), 2400);
    const t2 = setTimeout(() => setPhase("gone"), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (phase === "gone") return null;

  return (
    <div className={`mb-loader fixed inset-0 z-[200] grid place-items-center bg-[var(--vc-bg)] transition-opacity duration-500 ${phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <div className="vc-aurora absolute inset-0" />
      <div className="relative flex flex-col items-center gap-7">
        {/* the actual logo, drawn on then filled */}
        <div className="mb-logo-draw" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
        <div className="mb-loader-bar"><span /></div>
      </div>
    </div>
  );
}
