import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { MSection, MCard, MTone, mUsd } from "./ui";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

const KOLS = [
  { id: "ansem", name: "Ansem", handle: "blknoiz06", color: "#f59e0b" },
  { id: "cobie", name: "Cobie", handle: "cobie", color: "#22d3ee" },
  { id: "gcr", name: "GCR", handle: "GCRClassic", color: "#a78bfa" },
  { id: "hsaka", name: "Hsaka", handle: "HsakaTrades", color: "#34d399" },
  { id: "pentoshi", name: "Pentoshi", handle: "Pentosh1", color: "#60a5fa" },
  { id: "murad", name: "Murad", handle: "MustStopMurad", color: "#f472b6" },
  { id: "tetra", name: "Tetranode", handle: "Tetranode", color: "#fbbf24" },
  { id: "unipcs", name: "Bonk Guy", handle: "theunipcs", color: "#fb923c" },
  { id: "cupsey", name: "Cupsey", handle: "cupseyy", color: "#4ade80" },
  { id: "mando", name: "Mando", handle: "mando_ftw", color: "#2dd4bf" },
];

interface Linked { name: string; xHandle: string; addr: string; chain: "hl" | "evm"; value: number; pnl: number }
interface LB { linked: Linked[] }

export function MobileKol() {
  const [lb, setLb] = useState<LB | null>(null);
  useEffect(() => {
    fetch(`${BACKEND}/api/leaderboards`).then((r) => r.json()).then(setLb).catch(() => {});
  }, []);

  return (
    <div className="pb-6">
      <MSection title="Verified Smart Money">
        <div className="space-y-2">
          {(lb?.linked ?? []).map((k, i) => (
            <a key={i} href={`https://x.com/${k.xHandle}`} target="_blank" rel="noreferrer" className="block">
              <MCard className="flex items-center gap-3 px-3 py-2.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-[13px] font-bold text-accent">{k.name.slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold">{k.name}</div>
                  <div className="truncate text-[11px] text-muted">@{k.xHandle} · {k.chain.toUpperCase()}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold tabular-nums">{mUsd(k.value)}</div>
                  <MTone n={k.pnl}><span className="text-[11px]">{(k.pnl >= 0 ? "+" : "") + mUsd(k.pnl)}</span></MTone>
                </div>
              </MCard>
            </a>
          ))}
          {!lb && <div className="px-3 py-6 text-center text-[12px] text-faint">Loading wallets…</div>}
        </div>
      </MSection>

      <MSection title="KOLs on X">
        <div className="grid grid-cols-2 gap-2">
          {KOLS.map((k) => (
            <a key={k.id} href={`https://x.com/${k.handle}`} target="_blank" rel="noreferrer" className="block">
              <MCard className="flex items-center gap-2 px-3 py-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold" style={{ background: k.color + "22", color: k.color }}>{k.name.slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold">{k.name}</div>
                  <div className="truncate text-[10px] text-muted">@{k.handle}</div>
                </div>
                <ExternalLink size={13} className="shrink-0 text-faint" />
              </MCard>
            </a>
          ))}
        </div>
      </MSection>
    </div>
  );
}
