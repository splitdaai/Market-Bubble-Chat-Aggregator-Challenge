import { useEffect, useMemo, useState } from "react";
import { useStatsStore } from "@/store/statsStore";
import { useUserCardStore } from "@/store/userCardStore";
import { bucksFor, balanceFor } from "@/lib/bucks";
import { SourceBadge, platformColor } from "../SourceBadge";
import { compact } from "@/lib/format";

type Lens = "earned" | "spent" | "balance";

const LENSES: { id: Lens; label: string; desc: string; color: string }[] = [
  { id: "earned",  label: "Top Earners",   desc: "Lifetime 🫧 earned · watch + chat + subs + support", color: "#d9a547" },
  { id: "spent",   label: "Top Spenders",  desc: "Lifetime 🫧 spent · engagement, perks, viewer actions", color: "#f97316" },
  { id: "balance", label: "Top Balances",  desc: "Current available 🫧 · earned minus spent",           color: "#16e6a4" },
];

/**
 * Top-20 Bubble Bucks leaderboards for the analytics page — three lenses:
 * earned (lifetime), spent (lifetime), and current balance (earned − spent).
 * Rows are clickable to open the viewer's profile card.
 */
export function BubbleBucksAnalytics() {
  const listUsers = useStatsStore((s) => s.listUsers);
  // Re-derive on every snapshot tick — the store's listUsers function reference
  // is stable, so without this the memo would never re-evaluate and the ranks
  // wouldn't reflect new spend/earn data.
  const tick = useStatsStore((s) => s.snapshot.elapsedMs);
  const showUser = useUserCardStore((s) => s.show);
  const [lens, setLens] = useState<Lens>("earned");
  // Force a clean unmount of all rows on lens change so React can't reuse
  // DOM nodes keyed by username across a sort with different ranks.
  const [renderKey, setRenderKey] = useState(0);
  useEffect(() => { setRenderKey((k) => k + 1); }, [lens]);

  const { rows, totalEarned, totalSpent } = useMemo(() => {
    const users = listUsers();
    const enriched = users.map((u) => {
      const earned = bucksFor(u);
      const spent = u.spent ?? 0;
      const balance = balanceFor(u);
      return { ...u, earned, spent, balance };
    });
    const totalEarned = enriched.reduce((s, u) => s + u.earned, 0);
    const totalSpent = enriched.reduce((s, u) => s + u.spent, 0);
    const sorted = enriched
      .slice()
      .sort((a, b) => (lens === "earned" ? b.earned - a.earned : lens === "spent" ? b.spent - a.spent : b.balance - a.balance))
      .filter((u) => (lens === "earned" ? u.earned > 0 : lens === "spent" ? u.spent > 0 : u.balance > 0))
      .slice(0, 20);
    return { rows: sorted, totalEarned, totalSpent };
  }, [listUsers, lens, tick]);

  const max = Math.max(1, lens === "earned" ? (rows[0]?.earned ?? 1) : lens === "spent" ? (rows[0]?.spent ?? 1) : (rows[0]?.balance ?? 1));
  const valOf = (u: (typeof rows)[number]): number => (lens === "earned" ? u.earned : lens === "spent" ? u.spent : u.balance);

  return (
    <section className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-muted">
          <span aria-hidden>🫧</span> Bubble Bucks
        </h3>
        <span className="text-[11px] text-faint">
          {compact(totalEarned)} issued · {compact(totalSpent)} spent · {compact(Math.max(0, totalEarned - totalSpent))} circulating
        </span>
      </div>

      {/* Lens tabs */}
      <div className="mb-3 flex gap-1 rounded-lg bg-white/[0.03] p-1">
        {LENSES.map((l) => (
          <button
            key={l.id}
            onClick={() => setLens(l.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-bold transition ${
              lens === l.id ? "shadow-neon" : "text-muted hover:text-ink"
            }`}
            style={lens === l.id ? { background: `${l.color}22`, color: l.color, boxShadow: `0 0 14px ${l.color}33` } : undefined}
            title={l.desc}
          >
            {l.label}
          </button>
        ))}
      </div>

      <p className="mb-2 text-[10.5px] text-faint">{LENSES.find((l) => l.id === lens)!.desc}</p>

      {/* Top 20 */}
      <div key={renderKey} className="grid grid-cols-1 gap-1 md:grid-cols-2">
        {rows.length === 0 && (
          <div className="col-span-full grid place-items-center py-8 text-center text-[12px] text-muted">
            No viewers have {lens === "earned" ? "earned" : lens === "spent" ? "spent" : "any balance in"} Bubble Bucks yet.
          </div>
        )}
        {rows.map((u, i) => {
          const rank = i + 1;
          const rankColor = rank === 1 ? "#d9a547" : rank === 2 ? "#cbcbcb" : rank === 3 ? "#b97232" : "#7a7268";
          const value = valOf(u);
          return (
            <button
              key={`${u.platform}:${u.name}`}
              onClick={() => showUser(u.name, u.platform)}
              className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-white/8 px-2.5 py-2 text-left transition hover:border-accent/40"
              title={`Open ${u.name}'s profile`}
            >
              <span
                className="absolute inset-y-0 left-0 -z-0 rounded-l-lg opacity-15"
                style={{ width: `${(value / max) * 100}%`, background: platformColor(u.platform) }}
              />
              <span className="z-10 w-6 shrink-0 text-center text-xs font-extrabold tabular-nums" style={{ color: rankColor }}>
                #{rank}
              </span>
              <SourceBadge platform={u.platform} compact />
              {u.channel && <span className="z-10 shrink-0 text-[10px] font-semibold text-muted/80">{u.channel}</span>}
              <span className="z-10 flex-1 truncate text-sm font-semibold text-ink">{u.name}</span>
              <span className="z-10 flex shrink-0 items-baseline gap-0.5 text-[12px] font-extrabold tabular-nums" style={{ color: LENSES.find((l) => l.id === lens)!.color }}>
                <span className="opacity-70">🫧</span>{compact(value)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
