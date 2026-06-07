import { useEffect, useRef, useState } from "react";
import { Gauge } from "lucide-react";

/** Asset → TradingView symbol. */
const ASSETS: { label: string; symbol: string }[] = [
  { label: "BTC", symbol: "BINANCE:BTCUSDT" },
  { label: "ETH", symbol: "BINANCE:ETHUSDT" },
  { label: "SOL", symbol: "BINANCE:SOLUSDT" },
  { label: "SPX", symbol: "FOREXCOM:SPXUSD" },
  { label: "NDX", symbol: "NASDAQ:NDX" },
  { label: "GOLD", symbol: "TVC:GOLD" },
  { label: "OIL", symbol: "TVC:USOIL" },
  { label: "DXY", symbol: "TVC:DXY" },
  { label: "US10Y", symbol: "TVC:US10Y" },
];

/** Official TradingView Technical Analysis widget (free embed, no API key). */
function TVWidget({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    s.async = true;
    s.innerHTML = JSON.stringify({
      interval: "1D",
      width: "100%",
      isTransparent: true,
      height: 420,
      symbol,
      showIntervalTabs: true,
      displayMode: "single",
      locale: "en",
      colorTheme: "dark",
    });
    el.appendChild(s);
  }, [symbol]);
  return <div ref={ref} className="tradingview-widget-container" />;
}

export function TradingViewTechnicals() {
  const [sym, setSym] = useState(ASSETS[0]);
  return (
    <div className="vc-glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gauge size={15} className="text-accent" />
        <span className="serif text-[16px] font-bold tracking-tight">Technicals</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-faint">TradingView · live</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {ASSETS.map((a) => (
          <button
            key={a.label}
            onClick={() => setSym(a)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
              sym.label === a.label ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-white/8 bg-black/20">
        <TVWidget key={sym.symbol} symbol={sym.symbol} />
      </div>
    </div>
  );
}
