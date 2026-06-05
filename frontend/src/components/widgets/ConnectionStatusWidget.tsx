import { Eye } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";
import { useModeStore } from "@/store/modeStore";
import { SourceBadge, platformColor } from "../SourceBadge";
import { Sparkline } from "../Sparkline";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { compact } from "@/lib/format";

/**
 * Connection health + viewership. Each platform shows its total (viewers, trend,
 * latency, live dot) and nests every channel (Ansem / Banks / Market Bubble)
 * with its own viewer count + trend sparkline.
 */
export function ConnectionStatusWidget() {
  const statuses = useChatStore((s) => s.statuses);
  const perPlatform = useStatsStore((s) => s.snapshot.perPlatform);
  const accounts = useStatsStore((s) => s.snapshot.accounts);
  const demo = useModeStore((s) => s.demo);
  const toggleDemo = useModeStore((s) => s.toggle);
  const ALL = useActivePlatforms();
  const byPlatform = new Map(statuses.map((s) => [s.platform, s]));

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Connections</span>
        <button
          onClick={toggleDemo}
          title={demo ? "Demo data is ON — click to go live (use real data only)" : "Live mode — click for demo data"}
          className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition ${
            demo ? "bg-amber-400/15 text-amber-300 hover:bg-amber-400/25" : "bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${demo ? "bg-amber-400" : "bg-emerald-400"}`} />
          {demo ? "Demo" : "Live"}
        </button>
      </div>

      <div className="vc-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {ALL.map((p) => {
          const s = byPlatform.get(p);
          const ok = s?.connected ?? false;
          const channels = accounts.filter((a) => a.platform === p);
          return (
            <div key={p} className="rounded-lg border border-white/8 bg-white/[0.02]">
              {/* platform total */}
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <SourceBadge platform={p} />
                  <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-ink" title="Live viewers">
                    <Eye size={12} className="text-muted" /> {compact(perPlatform[p].viewers)}
                  </span>
                  <Sparkline data={perPlatform[p].history} color={platformColor(p)} width={46} height={16} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-muted">{s?.latencyMs ? `${s.latencyMs}ms` : "—"}</span>
                  <span className={`relative h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} title={ok ? "Connected" : "Disconnected"}>
                    {ok && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />}
                  </span>
                </div>
              </div>
              {/* nested channels */}
              {channels.length > 0 && (
                <div className="border-t border-white/5">
                  {channels.map((c) => (
                    <div key={c.accountId} className="flex items-center justify-between px-2.5 py-0.5 pl-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-px shrink-0 bg-white/15" />
                        <span className="max-w-[90px] truncate text-[11px] font-semibold text-muted">{c.displayName}</span>
                        <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-ink/80"><Eye size={9} className="text-muted opacity-60" /> {compact(c.viewers)}</span>
                      </div>
                      <Sparkline data={c.history} width={40} height={13} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
