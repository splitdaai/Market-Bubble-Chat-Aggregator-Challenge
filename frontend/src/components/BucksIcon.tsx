/**
 * Bubble Bucks coin — the currency mark. A gold coin bearing the Market
 * Bubble "MB" monogram with a dollar-style vertical stroke through the B,
 * set in the show's serif. Replaces the 🫧 emoji everywhere Bubble Bucks
 * amounts render so the currency reads as part of the brand.
 *
 * Pure inline SVG: crisp at any size, no font/image loading race in OBS.
 */
export function BucksIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-label="Bubble Bucks"
      role="img"
    >
      <defs>
        <linearGradient id="bb-coin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4d27a" />
          <stop offset="0.55" stopColor="#d9a547" />
          <stop offset="1" stopColor="#a87a2e" />
        </linearGradient>
        <linearGradient id="bb-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2115" />
          <stop offset="1" stopColor="#14100a" />
        </linearGradient>
      </defs>

      {/* Coin rim */}
      <circle cx="16" cy="16" r="15" fill="url(#bb-coin)" />
      {/* Coin face */}
      <circle cx="16" cy="16" r="12.2" fill="url(#bb-face)" />
      {/* Inner hairline */}
      <circle cx="16" cy="16" r="12.2" fill="none" stroke="#d9a547" strokeOpacity="0.55" strokeWidth="0.8" />

      {/* M — left, smaller, tucked behind the B like a ligature */}
      <text
        x="10.2"
        y="20.6"
        textAnchor="middle"
        fontFamily="'Playfair Display', Georgia, serif"
        fontWeight="800"
        fontSize="13"
        fill="#e8c987"
        opacity="0.85"
      >
        M
      </text>

      {/* B — dominant, right of center */}
      <text
        x="19.8"
        y="21.6"
        textAnchor="middle"
        fontFamily="'Playfair Display', Georgia, serif"
        fontWeight="800"
        fontSize="16"
        fill="#f4d27a"
      >
        B
      </text>

      {/* Dollar stroke through the B */}
      <line x1="19.8" y1="7.6" x2="19.8" y2="24.8" stroke="#f4d27a" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="19.8" y1="7.6" x2="19.8" y2="24.8" stroke="#14100a" strokeWidth="0.4" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
