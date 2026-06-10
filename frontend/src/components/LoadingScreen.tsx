import { useEffect, useState } from "react";

/**
 * Boot loading screen — draws the Market Bubble mark (the speech bubble + the
 * rising line that runs through it) with an SVG stroke "draw-on", the wordmark
 * fades up, then the whole overlay fades out. Shown once per page load.
 */
export function LoadingScreen() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    // ?loaderhold keeps the loading screen up (for previewing the animation).
    if (typeof window !== "undefined" && window.location.search.includes("loaderhold")) return;
    const t1 = setTimeout(() => setPhase("out"), 2000);
    const t2 = setTimeout(() => setPhase("gone"), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (phase === "gone") return null;

  return (
    <div className={`mb-loader fixed inset-0 z-[200] grid place-items-center bg-[var(--vc-bg)] transition-opacity duration-500 ${phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <div className="vc-aurora absolute inset-0" />
      <div className="relative flex flex-col items-center gap-6">
        <svg
          viewBox="0 0 24 24"
          className="h-32 w-32"
          fill="none"
          stroke="var(--vc-accent)"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 12px color-mix(in srgb, var(--vc-accent) 70%, transparent))" }}
        >
          {/* speech bubble */}
          <path className="mb-draw mb-draw-bubble" pathLength={1} d="M5 3.75 H19 a1.25 1.25 0 0 1 1.25 1.25 V15.5 a1.25 1.25 0 0 1 -1.25 1.25 H9.5 l-2.25 3 v-3 H5 a1.25 1.25 0 0 1 -1.25 -1.25 V5 a1.25 1.25 0 0 1 1.25 -1.25 Z" />
          {/* the line that runs through it, rising to the right */}
          <path className="mb-draw mb-draw-line" pathLength={1} d="M6.75 14 L10.5 10 L12.75 12.25 L17 7.5" />
          {/* arrow head */}
          <path className="mb-draw mb-draw-arrow" pathLength={1} d="M13.75 7.5 H17 V10.75" />
        </svg>

        <div className="mb-loader-word serif text-3xl font-extrabold tracking-tight">
          Market <span className="text-white">Bubble</span>
        </div>

        <div className="mb-loader-bar"><span /></div>
      </div>
    </div>
  );
}
