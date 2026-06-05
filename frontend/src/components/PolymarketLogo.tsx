/**
 * Polymarket brand lockup — the angular geometric mark + the "Polymarket"
 * wordmark in a clean geometric sans (distinct from the app's mono UI font),
 * matching Polymarket's own branding instead of plain text.
 */
export function PolymarketLogo({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="Polymarket" className="shrink-0">
        {/* hexagon container */}
        <path
          d="M20 2.5 L34.5 11 V29 L20 37.5 L5.5 29 V11 Z"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* folded-ribbon mark */}
        <path
          d="M13 26 V14 L20 18 L27 14 V26 L20 22 Z"
          fill="currentColor"
        />
      </svg>
      <span
        className="text-[15px] font-semibold leading-none tracking-tight"
        style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}
      >
        Polymarket
      </span>
    </span>
  );
}
