import { useState } from "react";
import { Eye } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useStatsStore } from "@/store/statsStore";
import { useModeStore } from "@/store/modeStore";
import { SourceBadge, platformColor } from "../SourceBadge";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { byStreamer } from "@/lib/streamers";
import { compact } from "@/lib/format";

/** Connection health + viewership, grouped by platform or by channel. */
export function ConnectionStatusWidget() {
  const statuses = useChatStore((s) => s.statuses);
  const perPlatform = useStatsStore((s) => s.snapshot.perPlatform);
  const accounts = useStatsStore((s) => s.snapshot.accounts);
  const demo = useModeStore((s) => s.demo);
  const toggleDemo = useModeStore((s) => s.toggle);
  const ALL = useActivePlatforms();
  const byPlatform = new Map(statuses.map((s) => [s.platform, s]));
  const [mode, setMode] = useState<"platform" | "channel">("platform");
  const streamers = byStreamer(accounts);

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

      {/* group toggle */}
      <div className="mb-2 flex gap-1 rounded-lg bg-white/[0.03] p-0.5">
        {(["platform", "channel"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-0.5 text-[10px] font-bold capitalize transition ${mode === m ? "bg-accent/20 text-accent" : "text-muted hover:text-ink"}`}
          >
            {m === "platform" ? "Platforms" : "Channels"}
          </button>
        ))}
      </div>

      <div className="vc-scroll flex flex-1 flex-col justify-center gap-2 overflow-y-auto">
        {mode === "platform"
          ? ALL.map((p) => {
              const s = byPlatform.get(p);
              const ok = s?.connected ?? false;
              return (
                <div key={p} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <SourceBadge platform={p} />
                    <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-ink" title="Live viewers">
                      <Eye size={12} className="text-muted" /> {compact(perPlatform[p].viewers)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tabular-nums text-muted">{s?.latencyMs ? `${s.latencyMs}ms` : "—"}</span>
                    <span className={`relative h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} title={ok ? "Connected" : "Disconnected"}>
                      {ok && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />}
                    </span>
                  </div>
                </div>
              );
            })
          : streamers.map((st) => (
              <div key={st.name} className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">{st.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-ink"><Eye size={12} className="text-muted" /> {compact(st.viewers)}</span>
                    <span className="relative h-2 w-2 rounded-full bg-emerald-400"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" /></span>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {st.platforms.map((p) => (
                    <span key={p} className="h-1.5 w-4 rounded-full" style={{ background: platformColor(p) }} title={p} />
                  ))}
                  <span className="ml-1 text-[9px] text-muted">{st.platforms.length} platform{st.platforms.length === 1 ? "" : "s"}</span>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
