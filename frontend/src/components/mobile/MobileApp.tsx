import { useState } from "react";
import { Radio, TrendingUp, Clapperboard, Crosshair, UserCircle2, Zap, Minimize2 } from "lucide-react";
import { useViewStore, type View } from "@/store/viewStore";
import { useModeStore } from "@/store/modeStore";
import { useViewerStore } from "@/store/viewerStore";
import { useUiModeStore } from "@/store/uiModeStore";
import { AccountModal } from "../AccountModal";
import { WatchlistDashboard } from "../WatchlistDashboard";
import { UserCard } from "../UserCard";
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
  const uiMode = useUiModeStore((s) => s.mode);
  const setUiMode = useUiModeStore((s) => s.setMode);
  const simple = uiMode === "simple";
  const [account, setAccount] = useState(false);
  const [dash, setDash] = useState(false);

  const active: View = (["live", "market", "content", "kol"] as View[]).includes(view) ? view : "live";

  return (
    <div className="mb-mobile vc-aurora vc-grid-texture relative flex h-[100dvh] flex-col bg-[var(--vc-bg)] text-ink">
      {/* header */}
      <header className="mb-mobile-safe-top relative z-10 flex shrink-0 items-center gap-2 border-b border-white/10 bg-[color:var(--vc-bg)]/70 px-3 pb-2 backdrop-blur-md">
        <img src="/market-bubble-logo.svg" alt="Market Bubble" className="h-[72px] w-auto shrink-0" />
        <button
          onClick={toggleDemo}
          className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold ${demo ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}
        >
          {demo ? "DEMO" : "LIVE"}
        </button>
        <button
          onClick={() => setUiMode(simple ? "pro" : "simple")}
          title={simple ? "Show markets, KOL & more" : "Simple view"}
          className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent"
        >
          {simple ? <><Zap size={11} /> Pro</> : <><Minimize2 size={11} /> Simple</>}
        </button>
        <button onClick={() => setAccount(true)} className="rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[12px] font-bold">
          {xHandle ? `@${xHandle}` : "Connect"}
        </button>
      </header>

      {/* content */}
      <main className="relative z-10 min-h-0 flex-1 overflow-hidden">
        {(simple || active === "live") && <MobileLive />}
        {!simple && active === "market" && <div className="vc-scroll h-full overflow-y-auto"><MobileMarket /></div>}
        {!simple && active === "content" && <div className="vc-scroll h-full overflow-y-auto"><MobileContent /></div>}
        {!simple && active === "kol" && <div className="vc-scroll h-full overflow-y-auto"><MobileKol /></div>}
      </main>

      {/* bottom tab bar — Pro only */}
      {!simple && (
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
      )}

      {account && <AccountModal open={account} onClose={() => setAccount(false)} onOpenDashboard={() => { setAccount(false); setDash(true); }} />}
      <WatchlistDashboard open={dash} onClose={() => setDash(false)} />
      <UserCard />
    </div>
  );
}
