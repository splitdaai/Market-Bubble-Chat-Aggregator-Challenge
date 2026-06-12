import { useEffect, useState } from "react";
import { Sparkline } from "../Sparkline";
import { BubbleScroll } from "../BubbleScroll";
import { MSection, MCard, MTone, mPrice, mPct, mUsd } from "./ui";
import { FALLBACK_MARKET_DATA } from "../../lib/marketFallback";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

interface MarketData {
  global: { sym: string; name: string; price: number; chg: number; spark: number[] }[];
  movers: { sym: string; price: number; chg: number; vol: number }[];
  gauges: { fearGreed: number; fearGreedLabel: string; btcDominance: number; totalMcap: number; altSeason: number };
}
interface LB {
  hyperliquid: { name: string; addr?: string; pnl: number }[];
  polymarket: { name: string; addr?: string; pnl: number }[];
  linked: { name: string; xHandle: string; value: number; pnl: number }[];
}

function Board({ title, rows, cap = 10 }: { title: string; rows: { name: string; sub: string; val: number; valFmt: string }[]; cap?: number }) {
  return (
    <MCard className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-faint">
        <span>{title}</span>
        {rows.length > cap && <span className="text-[9px] normal-case text-muted">top {cap} · scroll {rows.length - cap}+</span>}
      </div>
      <BubbleScroll maxHeight={cap * 43}>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5 last:border-0">
            <span className="w-4 shrink-0 text-[11px] font-bold text-faint">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold leading-tight">{r.name}</div>
              <div className="truncate text-[10px] leading-tight text-muted">{r.sub}</div>
            </div>
            <MTone n={r.val}>{r.valFmt}</MTone>
          </div>
        ))}
        {rows.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-faint">Loading…</div>}
      </BubbleScroll>
    </MCard>
  );
}

export function MobileMarket() {
  const [m, setM] = useState<MarketData>(FALLBACK_MARKET_DATA);
  const [lb, setLb] = useState<LB | null>(null);
  useEffect(() => {
    fetch(`${BACKEND}/api/market`).then((r) => r.json()).then((j) => {
      if (j && Array.isArray(j.global)) setM(j);
    }).catch(() => {});
    fetch(`${BACKEND}/api/leaderboards`).then((r) => r.json()).then(setLb).catch(() => {});
  }, []);

  const g = m.gauges;
  return (
    <div className="pb-6">
      {/* Pulse */}
      <MSection title="Market Pulse">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Fear / Greed", String(g.fearGreed), g.fearGreedLabel],
            ["BTC Dom", g.btcDominance.toFixed(1) + "%", "dominance"],
            ["Total Mcap", mUsd(g.totalMcap), "global"],
          ].map(([l, v, s]) => (
            <MCard key={l} className="px-2 py-2.5 text-center">
              <div className="text-[9px] uppercase tracking-wider text-faint">{l}</div>
              <div className="mt-0.5 text-[16px] font-extrabold text-accent">{v}</div>
              <div className="truncate text-[9px] text-muted">{s}</div>
            </MCard>
          ))}
        </div>
      </MSection>

      {/* Markets */}
      <MSection title="Global Markets" right={m.global.length > 6 ? <span className="text-[10px] text-muted">scroll {m.global.length - 6}+</span> : undefined}>
        <MCard className="overflow-hidden">
          <BubbleScroll maxHeight={330}>
            {m.global.map((a) => (
              <div key={a.sym} className="flex items-center gap-2 border-b border-white/5 px-3 py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold">{a.sym}</div>
                  <div className="truncate text-[10px] text-muted">{a.name}</div>
                </div>
                {a.spark?.length > 1 && (
                  <Sparkline data={a.spark} width={56} height={20} color={a.chg >= 0 ? "#16e6a4" : "#ff5a6a"} />
                )}
                <div className="w-[78px] text-right">
                  <div className="text-[12.5px] font-semibold tabular-nums">{mPrice(a.price)}</div>
                  <MTone n={a.chg}><span className="text-[11px]">{mPct(a.chg)}</span></MTone>
                </div>
              </div>
            ))}
          </BubbleScroll>
        </MCard>
      </MSection>

      {/* Movers */}
      {m.movers.length ? (
        <MSection title="Top Movers">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {m.movers.slice(0, 10).map((mv) => (
              <MCard key={mv.sym} className="min-w-[110px] px-3 py-2">
                <div className="text-[12px] font-bold">{mv.sym}</div>
                <div className="text-[12px] tabular-nums">{mPrice(mv.price)}</div>
                <MTone n={mv.chg}><span className="text-[11px]">{mPct(mv.chg)}</span></MTone>
              </MCard>
            ))}
          </div>
        </MSection>
      ) : null}

      {/* Leaderboards */}
      <MSection title="Top Hyperliquid Traders">
        <Board title="Hyperliquid · PnL" cap={10} rows={(lb?.hyperliquid ?? []).map((r) => ({ name: r.name, sub: "Hyperliquid", val: r.pnl, valFmt: (r.pnl >= 0 ? "+" : "") + mUsd(r.pnl) }))} />
      </MSection>
      <MSection title="Top Polymarket Traders">
        <Board title="Polymarket · PnL" cap={5} rows={(lb?.polymarket ?? []).map((r) => ({ name: r.name, sub: "Polymarket", val: r.pnl, valFmt: (r.pnl >= 0 ? "+" : "") + mUsd(r.pnl) }))} />
      </MSection>
      <MSection title="Verified KOL Wallets">
        <Board title="Smart money · value" cap={10} rows={(lb?.linked ?? []).map((r) => ({ name: r.name, sub: "@" + r.xHandle, val: r.value, valFmt: mUsd(r.value) }))} />
      </MSection>
    </div>
  );
}
