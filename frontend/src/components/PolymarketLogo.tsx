/**
 * Polymarket brand lockup — the angular geometric mark + the "Polymarket"
 * wordmark in a clean geometric sans (distinct from the app's mono UI font),
 * matching Polymarket's own branding instead of plain text.
 */
export function PolymarketLogo({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-label="Polymarket" className="shrink-0">
        {/* two stacked sheared trapezoids — Polymarket's flag mark */}
        <path d="M4 5 H20 L14 11 H4 Z" />
        <path d="M4 13 H20 L14 19 H4 Z" />
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
