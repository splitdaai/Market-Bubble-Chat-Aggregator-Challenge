import { useMemo, useState } from "react";
import { Search, Shield, DollarSign, Gift, Wallet } from "lucide-react";
import type { Platform, ModerationAction } from "@shared/types";
import { useStatsStore, type UserRow } from "@/store/statsStore";
import { useToastStore } from "@/store/toastStore";
import { useModeStore } from "@/store/modeStore";
import { useUserCardStore } from "@/store/userCardStore";
import { moderate } from "@/lib/api";
import { SourceBadge, platformLabel, platformColor } from "../SourceBadge";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { ModMenu } from "../ModMenu";
import { viewerWallet } from "@/lib/viewerWallets";
import { compact } from "@/lib/format";

type ListUser = UserRow;

function ago(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

const CAP = 250;

/** Cross-platform viewer list with per-user moderation. */
export function UserList() {
  const snap = useStatsStore((s) => s.snapshot);
  const listUsers = useStatsStore((s) => s.listUsers);
  const push = useToastStore((s) => s.push);
  const demo = useModeStore((s) => s.demo);
  const showUser = useUserCardStore((s) => s.show);
  const platforms = useActivePlatforms();

  const [tab, setTab] = useState<"all" | Platform>("all");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; user: ListUser } | null>(null);

  // Real chatters across all platforms, re-derived each stats tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo<ListUser[]>(() => listUsers(), [snap, listUsers]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((u) => (tab === "all" || u.platform === tab) && (!needle || u.name.toLowerCase().includes(needle)))
      .sort((a, b) => b.count - a.count);
  }, [all, tab, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const p of platforms) c[p] = all.filter((u) => u.platform === p).length;
    return c;
  }, [all, platforms]);

  const handleModerate = async (u: ListUser, action: ModerationAction) => {
    const res = await moderate({ platform: u.platform, username: u.name, action });
    const verb =
      action.kind === "timeout" ? `Timed out ${u.name} (${action.seconds}s)`
      : action.kind === "ban" ? `Banned ${u.name}`
      : action.kind === "unban" ? `Unbanned ${u.name}`
      : action.kind === "slow" ? `Slow mode ${action.seconds}s`
      : `Removed ${u.name}'s message`;
    push({ message: res.ok ? `${verb} · ${u.platform}` : `Failed: ${res.error}`, tone: res.ok ? "ok" : "error" });
  };

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Users</span>
        <span className="text-[10px] text-muted">{compact(all.length)} total</span>
      </div>

      {/* tabs — wrap so every platform is visible (no horizontal scroll) */}
      <div className="mb-2 flex flex-wrap gap-1">
        <Tab label="All" active={tab === "all"} onClick={() => setTab("all")} n={counts.all} />
        {platforms.map((p) => (
          <Tab key={p} label={platformLabel(p)} active={tab === p} onClick={() => setTab(p)} n={counts[p]} color={platformColor(p)} />
        ))}
      </div>

      {/* search */}
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5">
        <Search size={13} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>

      {/* list */}
      <div className="vc-scroll flex-1 space-y-0.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="grid h-full place-items-center text-[11px] text-muted opacity-70">No users</div>
        ) : (
          filtered.slice(0, CAP).map((u, i) => {
            const tippable = !!viewerWallet(u.name, demo);
            return (
              <button
                key={`${u.platform}:${u.name}:${i}`}
                onClick={() => showUser(u.name, u.platform)}
                onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, user: u }); }}
                title="View profile & messages — right-click to moderate"
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-white/[0.05]"
              >
                <SourceBadge platform={u.platform} compact />
                <span className="flex-1 truncate text-sm font-semibold text-ink">{u.name}</span>
                {tippable && (
                  <Wallet size={12} className="shrink-0 text-emerald-400" aria-label="Wallet-connected — can receive tips" />
                )}
                {u.donated > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400"><DollarSign size={9} />{compact(u.donated)}</span>
                )}
                {u.subs > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-accent"><Gift size={9} />{u.subs}</span>
                )}
                <span className="w-8 text-right text-[10px] tabular-nums text-muted">{compact(u.count)}</span>
                <span className="w-7 text-right text-[10px] tabular-nums text-muted opacity-60">{ago(u.last)}</span>
                <Shield size={12} className="text-muted opacity-0 transition group-hover:opacity-100 group-hover:text-accent" />
              </button>
            );
          })
        )}
        {filtered.length > CAP && (
          <div className="py-2 text-center text-[10px] text-muted">Showing top {CAP} of {compact(filtered.length)} — search to narrow</div>
        )}
      </div>

      {menu && (
        <ModMenu
          at={{ x: menu.x, y: menu.y }}
          username={menu.user.name}
          platform={menu.user.platform}
          hideDelete
          onClose={() => setMenu(null)}
          onAction={(a) => { handleModerate(menu.user, a); setMenu(null); }}
        />
      )}
    </div>
  );
}

function Tab({ label, active, onClick, n, color }: { label: string; active: boolean; onClick: () => void; n?: number; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${
        active ? "bg-accent/20 text-accent shadow-neon" : "text-muted hover:text-ink"
      }`}
      style={active && color ? { color } : undefined}
    >
      {label}
      {n != null && <span className="rounded bg-white/10 px-1 text-[9px] tabular-nums">{compact(n)}</span>}
    </button>
  );
}
