import { useEffect, useRef, useState } from "react";
import { Gauge, Search } from "lucide-react";

/** Top ~50 tickers as TradingView symbols (crypto + stocks + indices + commodities). */
const TOP: { label: string; symbol: string }[] = [
  { label: "BTC", symbol: "BINANCE:BTCUSDT" }, { label: "ETH", symbol: "BINANCE:ETHUSDT" },
  { label: "SOL", symbol: "BINANCE:SOLUSDT" }, { label: "BNB", symbol: "BINANCE:BNBUSDT" },
  { label: "XRP", symbol: "BINANCE:XRPUSDT" }, { label: "DOGE", symbol: "BINANCE:DOGEUSDT" },
  { label: "ADA", symbol: "BINANCE:ADAUSDT" }, { label: "AVAX", symbol: "BINANCE:AVAXUSDT" },
  { label: "LINK", symbol: "BINANCE:LINKUSDT" }, { label: "TRX", symbol: "BINANCE:TRXUSDT" },
  { label: "SUI", symbol: "BINANCE:SUIUSDT" }, { label: "WIF", symbol: "BINANCE:WIFUSDT" },
  { label: "PEPE", symbol: "BINANCE:PEPEUSDT" }, { label: "BONK", symbol: "BINANCE:BONKUSDT" },
  { label: "JUP", symbol: "BINANCE:JUPUSDT" }, { label: "ONDO", symbol: "BINANCE:ONDOUSDT" },
  { label: "HYPE", symbol: "KUCOIN:HYPEUSDT" }, { label: "VIRTUAL", symbol: "BINANCE:VIRTUALUSDT" },
  { label: "AAVE", symbol: "BINANCE:AAVEUSDT" }, { label: "UNI", symbol: "BINANCE:UNIUSDT" },
  { label: "LTC", symbol: "BINANCE:LTCUSDT" }, { label: "NEAR", symbol: "BINANCE:NEARUSDT" },
  { label: "TON", symbol: "BINANCE:TONUSDT" }, { label: "ARB", symbol: "BINANCE:ARBUSDT" },
  { label: "OP", symbol: "BINANCE:OPUSDT" }, { label: "INJ", symbol: "BINANCE:INJUSDT" },
  { label: "RENDER", symbol: "BINANCE:RENDERUSDT" }, { label: "FET", symbol: "BINANCE:FETUSDT" },
  { label: "POPCAT", symbol: "BINANCE:POPCATUSDT" }, { label: "PNUT", symbol: "BINANCE:PNUTUSDT" },
  { label: "AAPL", symbol: "NASDAQ:AAPL" }, { label: "NVDA", symbol: "NASDAQ:NVDA" },
  { label: "TSLA", symbol: "NASDAQ:TSLA" }, { label: "MSFT", symbol: "NASDAQ:MSFT" },
  { label: "AMZN", symbol: "NASDAQ:AMZN" }, { label: "META", symbol: "NASDAQ:META" },
  { label: "GOOGL", symbol: "NASDAQ:GOOGL" }, { label: "COIN", symbol: "NASDAQ:COIN" },
  { label: "MSTR", symbol: "NASDAQ:MSTR" }, { label: "HOOD", symbol: "NASDAQ:HOOD" },
  { label: "SPX", symbol: "FOREXCOM:SPXUSD" }, { label: "NDX", symbol: "NASDAQ:NDX" },
  { label: "DJI", symbol: "DJ:DJI" }, { label: "VIX", symbol: "TVC:VIX" },
  { label: "DXY", symbol: "TVC:DXY" }, { label: "US10Y", symbol: "TVC:US10Y" },
  { label: "GOLD", symbol: "TVC:GOLD" }, { label: "SILVER", symbol: "TVC:SILVER" },
  { label: "OIL", symbol: "TVC:USOIL" }, { label: "NATGAS", symbol: "TVC:NATURALGAS" },
];

/** Map a plain ticker label (BTC, SPX, GOLD…) to a TradingView symbol. */
export function tvSymbolFor(label: string): string {
  const up = label.trim().toUpperCase();
  const known = TOP.find((t) => t.label === up);
  return known ? known.symbol : resolveSymbol(up);
}

/** Build a TradingView symbol from free-text input. */
function resolveSymbol(q: string): string {
  const s = q.trim().toUpperCase();
  if (!s) return "BINANCE:BTCUSDT";
  if (s.includes(":")) return s;
  const known = TOP.find((t) => t.label === s);
  if (known) return known.symbol;
  if (/USDT?$|USD$/.test(s)) return `BINANCE:${s.replace("USD", "USDT").replace("USDTT", "USDT")}`;
  return `BINANCE:${s}USDT`; // default: treat as a crypto pair
}

function tvWidget(el: HTMLDivElement, src: string, config: Record<string, unknown>) {
  el.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  s.innerHTML = JSON.stringify(config);
  el.appendChild(s);
}

export function MiniChart({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) tvWidget(ref.current, "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js", {
      symbol, width: "100%", height: 180, locale: "en", dateRange: "3M", colorTheme: "dark", isTransparent: true, autosize: false, chartOnly: false,
    });
  }, [symbol]);
  return <div ref={ref} className="tradingview-widget-container" />;
}

export function TechWidget({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) tvWidget(ref.current, "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js", {
      interval: "1D", width: "100%", isTransparent: true, height: 400, symbol, showIntervalTabs: true, displayMode: "single", locale: "en", colorTheme: "dark",
    });
  }, [symbol]);
  return <div ref={ref} className="tradingview-widget-container" />;
}

function AdvancedChart({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) tvWidget(ref.current, "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js", {
      symbol, autosize: true, interval: "D", timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en",
      hide_side_toolbar: true, allow_symbol_change: false, save_image: false, calendar: false,
      backgroundColor: "rgba(0,0,0,0)", gridColor: "rgba(255,255,255,0.05)",
      studies: ["STD;RSI", "STD;MACD"],
    });
  }, [symbol]);
  return <div ref={ref} className="tradingview-widget-container h-full [&>div]:h-full [&_iframe]:h-full" />;
}

export function TradingViewTechnicals() {
  const [sym, setSym] = useState(TOP[0]);
  const [q, setQ] = useState("");
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!q.trim()) return; setSym({ label: q.trim().toUpperCase(), symbol: resolveSymbol(q) }); };

  return (
    <div className="vc-glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gauge size={15} className="text-accent" />
        <span className="serif text-[16px] font-bold tracking-tight">Technicals</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-faint">TradingView · live · {sym.label}</span>
      </div>

      {/* search any ticker */}
      <form onSubmit={submit} className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5">
        <Search size={13} className="text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any ticker — BTC, AAPL, NASDAQ:NVDA, BINANCE:WIFUSDT…" className="flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-faint" />
        <button type="submit" className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">Go</button>
      </form>

      {/* top 50 quick-select */}
      <div className="bubble-scroll-area mb-3 flex gap-1 overflow-x-auto pb-1">
        {TOP.map((a) => (
          <button key={a.symbol} onClick={() => setSym(a)} className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold transition ${sym.symbol === a.symbol ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"}`}>{a.label}</button>
        ))}
      </div>

      {/* big interactive chart (RSI + MACD) + analysis gauge */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.7fr_1fr]">
        <div className="h-[420px] overflow-hidden rounded-xl border border-white/8 bg-black/20"><AdvancedChart key={"a" + sym.symbol} symbol={sym.symbol} /></div>
        <div className="h-[420px] overflow-hidden rounded-xl border border-white/8 bg-black/20"><TechWidget key={"t" + sym.symbol} symbol={sym.symbol} /></div>
      </div>
    </div>
  );
}
