import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, X, Trash2, Copy, Download, Filter } from "lucide-react";
import { useDebugLog, type DebugLevel } from "@/lib/debugLog";

/**
 * Floating debug-log overlay — fixed bottom-right pill that opens a panel
 * showing every captured error / warn / event with timestamps + stack traces.
 * Hidden by default; toggle with the keyboard shortcut ⌥+D or by appending
 * `?debug=1` to any URL.
 *
 * Why visible in production: when something breaks for a streamer in OBS,
 * we want them to be able to open this, hit Copy, and paste us the trail.
 */

const COLORS: Record<DebugLevel, { fg: string; bg: string; label: string }> = {
  error: { fg: "#ff8a8a", bg: "rgba(239,68,68,0.14)", label: "ERR" },
  warn:  { fg: "#fbbf24", bg: "rgba(251,191,36,0.14)", label: "WARN" },
  info:  { fg: "#7dd3fc", bg: "rgba(56,189,248,0.12)", label: "INFO" },
  debug: { fg: "#a3a3a3", bg: "rgba(163,163,163,0.10)", label: "DBG" },
  event: { fg: "#e8c987", bg: "rgba(217,165,71,0.12)", label: "EVT" },
};

export function DebugLogOverlay() {
  const entries = useDebugLog((s) => s.entries);
  const unread = useDebugLog((s) => s.unread);
  const clear = useDebugLog((s) => s.clear);
  const markRead = useDebugLog((s) => s.markRead);
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has("debug"));
  const [filter, setFilter] = useState<DebugLevel | "all">("all");
  const [search, setSearch] = useState("");

  // Toggle with ⌥+D
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) markRead(); }, [open, markRead]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => (filter === "all" || e.level === filter))
      .filter((e) => !q || e.message.toLowerCase().includes(q) || (e.source && e.source.toLowerCase().includes(q)) || (e.detail || "").toLowerCase().includes(q));
  }, [entries, filter, search]);

  const copyAll = async () => {
    const text = entries.map((e) => formatEntry(e)).join("\n\n");
    try { await navigator.clipboard.writeText(text); } catch { /* fallthrough */ }
  };
  const download = () => {
    const blob = new Blob([entries.map(formatEntry).join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marketbubble-debug-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorCount = entries.filter((e) => e.level === "error").length;
  const warnCount = entries.filter((e) => e.level === "warn").length;

  return (
    <>
      {/* Floating pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Debug log (⌥+D)"
        className="fixed bottom-4 right-4 z-[400] flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold transition hover:brightness-125"
        style={{ background: errorCount > 0 ? "rgba(239,68,68,0.18)" : "rgba(8,7,6,0.82)", border: errorCount > 0 ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(217,165,71,0.35)", color: errorCount > 0 ? "#ff8a8a" : "#e8c987", backdropFilter: "blur(8px)" }}
      >
        <Bug size={14} />
        {errorCount > 0 ? `${errorCount} err` : warnCount > 0 ? `${warnCount} warn` : "Debug"}
        {unread > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{unread}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-16 right-4 z-[401] flex h-[60vh] w-[min(640px,92vw)] flex-col overflow-hidden rounded-xl"
            style={{ background: "#0e0c0a", border: "1px solid rgba(217,165,71,0.35)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-white/8 px-3 py-2">
              <Bug size={14} style={{ color: "#e8c987" }} />
              <span className="text-[12px] font-black uppercase tracking-[0.12em]" style={{ color: "#e8c987" }}>Debug log</span>
              <span className="text-[10px] font-bold text-muted">
                {entries.length} entries · {errorCount} err · {warnCount} warn
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={copyAll} title="Copy all" className="rounded p-1 text-muted transition hover:text-accent"><Copy size={13} /></button>
                <button onClick={download} title="Download .log" className="rounded p-1 text-muted transition hover:text-accent"><Download size={13} /></button>
                <button onClick={clear} title="Clear" className="rounded p-1 text-muted transition hover:text-red-300"><Trash2 size={13} /></button>
                <button onClick={() => setOpen(false)} title="Close" className="rounded p-1 text-muted transition hover:text-ink"><X size={13} /></button>
              </div>
            </header>

            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/8 px-3 py-2">
              <Filter size={11} className="text-muted" />
              {(["all", "error", "warn", "info", "event", "debug"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilter(lvl)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${filter === lvl ? "bg-accent/25 text-accent" : "text-muted hover:text-ink"}`}
                >
                  {lvl}
                </button>
              ))}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="ml-auto w-40 rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] font-mono text-ink placeholder-muted focus:border-accent/50 focus:outline-none"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px]">
              {visible.length === 0 ? (
                <div className="grid h-full place-items-center text-center text-muted">
                  <div>
                    <div className="text-[13px] font-bold">{entries.length === 0 ? "🟢 No errors captured" : "No matches"}</div>
                    <div className="mt-1 text-[10px] text-muted/70">Errors, console warnings and tracked events show up here as they happen.</div>
                  </div>
                </div>
              ) : (
                visible.slice().reverse().map((e) => {
                  const c = COLORS[e.level];
                  return (
                    <div key={e.id} className="border-b border-white/5 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded px-1 py-0.5 text-[9px] font-black tracking-wider" style={{ color: c.fg, background: c.bg }}>{c.label}</span>
                        <span className="text-[10px] text-muted/70 tabular-nums">{new Date(e.t).toLocaleTimeString()}</span>
                        <span className="truncate text-[10px] font-semibold text-muted">{e.source}</span>
                      </div>
                      <div className="mt-1 break-words text-[12px] leading-snug" style={{ color: c.fg }}>{e.message}</div>
                      {e.detail && (
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-2 text-[10px] leading-relaxed text-muted">{e.detail}</pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function formatEntry(e: { t: number; level: string; source: string; message: string; detail?: string; url?: string }): string {
  return `[${new Date(e.t).toISOString()}] ${e.level.toUpperCase()} ${e.source}\n  ${e.message}${e.url ? `\n  url: ${e.url}` : ""}${e.detail ? `\n  ${e.detail.split("\n").join("\n  ")}` : ""}`;
}
