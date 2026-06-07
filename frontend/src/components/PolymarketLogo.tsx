/**
 * Polymarket brand lockup — the angular geometric mark + the "Polymarket"
 * wordmark in a clean geometric sans (distinct from the app's mono UI font),
 * matching Polymarket's own branding instead of plain text.
 */
export function PolymarketLogo({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <svg width={size} height={size} viewBox="-2 0 140 168" fill="currentColor" aria-label="Polymarket" className="shrink-0">
        {/* Official Polymarket mark (from polymarket.com) */}
        <path fillRule="evenodd" clipRule="evenodd" d="M136.267 152.495C136.267 159.76 136.267 163.392 133.891 165.192C131.516 166.993 128.019 166.012 121.024 164.049L8.63192 132.51C4.41793 131.328 2.31093 130.737 1.09248 129.129C-0.125977 127.522 -0.125977 125.333 -0.125977 120.957V47.0434C-0.125977 42.6667 -0.125977 40.4783 1.09248 38.8709C2.31093 37.2634 4.41792 36.6722 8.63191 35.4897L121.024 3.95096C128.019 1.98834 131.516 1.00703 133.891 2.80771C136.267 4.60839 136.267 8.24049 136.267 15.5047V152.495ZM27.9043 122.228L120.966 148.345V96.1133L27.9043 122.228ZM15.1738 110.111L108.217 84L15.1738 57.8887V110.111ZM27.9033 45.7725L120.966 71.8877V19.6553L27.9033 45.7725Z" />
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
