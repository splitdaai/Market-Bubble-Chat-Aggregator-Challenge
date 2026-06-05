import { Eye } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";
import { SourceBadge } from "../SourceBadge";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { compact } from "@/lib/format";

/** Per-platform connection health pills, each showing live viewership. */
export function ConnectionStatusWidget() {
  const statuses = useChatStore((s) => s.statuses);
  const isMock = useChatStore((s) => s.isMock);
  const perPlatform = useStatsStore((s) => s.snapshot.perPlatform);
  const ALL = useActivePlatforms();
  const byPlatform = new Map(statuses.map((s) => [s.platform, s]));

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Connections</span>
        {isMock && (
          <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
            Demo
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2">
        {ALL.map((p) => {
          const s = byPlatform.get(p);
          const ok = s?.connected ?? false;
          const viewers = perPlatform[p].viewers;
          return (
            <div key={p} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <SourceBadge platform={p} />
                <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-ink" title="Live viewers">
                  <Eye size={12} className="text-muted" /> {compact(viewers)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] tabular-nums text-muted">{s?.latencyMs ? `${s.latencyMs}ms` : "—"}</span>
                <span
                  className={`relative h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`}
                  title={ok ? "Connected" : "Disconnected"}
                >
                  {ok && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
