import { useEffect, useState } from "react";

/**
 * Boot loading screen — the REAL Market Bubble logo (the white wordmark + chart
 * mark) wipes in left→right, a light/gold shine sweeps across it, with a soft
 * glow, then the overlay fades to the app. Uses the actual logo SVG as a CSS
 * mask so it's the exact artwork. Shown once per page load.
 * `?loaderhold` keeps it up for previewing.
 */
export function LoadingScreen() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("loaderhold")) return;
    const t1 = setTimeout(() => setPhase("out"), 2200);
    const t2 = setTimeout(() => setPhase("gone"), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (phase === "gone") return null;

  return (
    <div className={`mb-loader fixed inset-0 z-[200] grid place-items-center bg-[var(--vc-bg)] transition-opacity duration-500 ${phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <div className="vc-aurora absolute inset-0" />
      <div className="relative flex flex-col items-center gap-7">
        {/* the actual Market Bubble logo, masked so we can fill + shine it */}
        <div className="mb-logo-wrap relative h-44 w-72">
          <div className="mb-logo mb-logo-base" />
          <div className="mb-logo mb-logo-shine" />
        </div>
        <div className="mb-loader-bar"><span /></div>
      </div>
    </div>
  );
}
