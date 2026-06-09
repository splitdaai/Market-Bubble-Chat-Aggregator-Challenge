import type { ReactNode } from "react";
import { compact } from "@/lib/format";

/** Shared mobile primitives + formatters so every mobile view looks identical. */
export const mUsd = (n: number) => (n < 0 ? "-$" : "$") + compact(Math.abs(n));
export const mPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
export const mPrice = (n: number) =>
  n >= 1000
    ? "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "$" + n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 });

export function MSection({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="px-3 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function MCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/8 bg-white/[0.03] ${className}`}>{children}</div>;
}

export function MTone({ n, children }: { n: number; children: ReactNode }) {
  return <span className={`tabular-nums font-bold ${n >= 0 ? "text-up" : "text-down"}`}>{children}</span>;
}
