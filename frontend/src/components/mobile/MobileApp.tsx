import { useState } from "react";
import { Radio, TrendingUp, Clapperboard, Crosshair, UserCircle2 } from "lucide-react";
import { useViewStore, type View } from "@/store/viewStore";
import { useModeStore } from "@/store/modeStore";
import { useViewerStore } from "@/store/viewerStore";
import { MarketBubbleMark } from "../Brand";
import { AccountModal } from "../AccountModal";
import { WatchlistDashboard } from "../WatchlistDashboard";
import { MobileLive } from "./MobileLive";
import { MobileMarket } from "./MobileMarket";
import { MobileKol } from "./MobileKol";
import { MobileContent } from "./MobileContent";

const TABS = [
  { key: "live", label: "Live", Icon: Radio },
  { key: "market", label: "Markets", Icon: TrendingUp },
  { key: "content", label: "Content", Icon: Clapperboard },
  { key: "kol", label: "KOL", Icon: Crosshair },
] as const;

/**
 * Dedicated phone shell — sticky header + a single full-screen view + a native
 * bottom tab bar. Only mounted on mobile viewports, so the desktop dashboard is
 * never affected.
 */
export function MobileApp() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const demo = useModeStore((s) => s.demo);
  const toggleDemo = useModeStore((s) => s.toggle);
  const xHandle = useViewerStore((s) => s.xHandle);
  const [account, setAccount] = useState(false);
  const [dash, setDash] = useState(false);

  const active: View = (["live", "market", "content", "kol"] as View[]).includes(view) ? view : "live";

  return (
    <div className="mb-mobile vc-aurora vc-grid-texture relative flex h-[100dvh] flex-col bg-[var(--vc-bg)] text-ink">
      {/* header */}
      <header className="mb-mobile-safe-top relative z-10 flex shrink-0 items-center gap-2 border-b border-white/10 bg-[color:var(--vc-bg)]/70 px-3 pb-2 backdrop-blur-md">
        <div className="grid h-8 w-8 place-items-center rounded-xl border border-accent/40 bg-accent/10">
          <MarketBubbleMark className="h-5 w-5 text-accent" />
        </div>
        <div className="serif text-[15px] font-extrabold leading-none">Market <span className="text-white">Bubble</span></div>
        <button
          onClick={toggleDemo}
          className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold ${demo ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}
        >
          {demo ? "DEMO" : "LIVE"}
        </button>
        <button onClick={() => setAccount(true)} className="rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[12px] font-bold">
          {xHandle ? `@${xHandle}` : "Connect"}
        </button>
      </header>

      {/* content */}
      <main className="relative z-10 min-h-0 flex-1 overflow-hidden">
        {active === "live" && <MobileLive />}
        {active === "market" && <div className="vc-scroll h-full overflow-y-auto"><MobileMarket /></div>}
        {active === "content" && <div className="vc-scroll h-full overflow-y-auto"><MobileContent /></div>}
        {active === "kol" && <div className="vc-scroll h-full overflow-y-auto"><MobileKol /></div>}
      </main>

      {/* bottom tab bar */}
      <nav className="mb-tabbar relative z-10 flex shrink-0 items-stretch justify-around border-t border-white/10 bg-[color:var(--vc-bg)]/80 backdrop-blur-md">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex flex-1 flex-col items-center gap-0.5 pt-2 text-[10px] font-semibold transition ${active === key ? "text-accent" : "text-muted"}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button
          onClick={() => setAccount(true)}
          className="flex flex-1 flex-col items-center gap-0.5 pt-2 text-[10px] font-semibold text-muted"
        >
          <UserCircle2 size={20} />
          <span>You</span>
        </button>
      </nav>

      {account && <AccountModal open={account} onClose={() => setAccount(false)} onOpenDashboard={() => { setAccount(false); setDash(true); }} />}
      <WatchlistDashboard open={dash} onClose={() => setDash(false)} />
    </div>
  );
}
