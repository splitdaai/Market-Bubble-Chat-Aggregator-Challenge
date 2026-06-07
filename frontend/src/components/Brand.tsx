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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 5 H20 L14 11 H4 Z" />
      <path d="M4 13 H20 L14 19 H4 Z" />
    </svg>
  );
}
