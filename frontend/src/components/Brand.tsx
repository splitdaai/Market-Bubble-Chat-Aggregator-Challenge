/** Brand marks as crisp vector line-art (transparent, theme-colored). */
export function MarketBubbleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 3.75 H19 a1.25 1.25 0 0 1 1.25 1.25 V15.5 a1.25 1.25 0 0 1 -1.25 1.25 H9.5 l-2.25 3 v-3 H5 a1.25 1.25 0 0 1 -1.25 -1.25 V5 a1.25 1.25 0 0 1 1.25 -1.25 Z" />
      <path d="M6.75 14 L10.5 10 L12.75 12.25 L17 7.5" />
      <path d="M13.75 7.5 H17 V10.75" />
    </svg>
  );
}
export function PolymarketMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-2 0 140 168" fill="currentColor" className={className} aria-hidden>
      {/* Official Polymarket mark (from polymarket.com) */}
      <path fillRule="evenodd" clipRule="evenodd" d="M136.267 152.495C136.267 159.76 136.267 163.392 133.891 165.192C131.516 166.993 128.019 166.012 121.024 164.049L8.63192 132.51C4.41793 131.328 2.31093 130.737 1.09248 129.129C-0.125977 127.522 -0.125977 125.333 -0.125977 120.957V47.0434C-0.125977 42.6667 -0.125977 40.4783 1.09248 38.8709C2.31093 37.2634 4.41792 36.6722 8.63191 35.4897L121.024 3.95096C128.019 1.98834 131.516 1.00703 133.891 2.80771C136.267 4.60839 136.267 8.24049 136.267 15.5047V152.495ZM27.9043 122.228L120.966 148.345V96.1133L27.9043 122.228ZM15.1738 110.111L108.217 84L15.1738 57.8887V110.111ZM27.9033 45.7725L120.966 71.8877V19.6553L27.9033 45.7725Z" />
    </svg>
  );
}
