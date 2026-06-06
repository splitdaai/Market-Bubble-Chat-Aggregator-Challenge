import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Dead-simple, privacy-clean visit log. One JSON line per page load so the owner
 * can see *if and when* people visit — that's it. No IP addresses, no device
 * fingerprinting, no cookies, no third-party analytics. We record only the time,
 * which page was opened, and (if the browser sends it) where the visitor came
 * from. The file is git-ignored (lives under backend/data/).
 */
const LOG_PATH = process.env.VISIT_LOG_PATH ?? "data/visits.log";

export interface VisitEntry {
  path?: string;
  ref?: string;
  /** Anonymous first-party visitor id (random, no PII) — used to count uniques. */
  vid?: string;
}

/** A logged visit — a VisitEntry plus the server-stamped timestamp. */
export interface Visit extends VisitEntry {
  ts?: string;
}

/** Where a visit came from. A `?src=`/`?utm_source=` tag on the URL wins (the
 *  reliable signal — referrers are stripped on the https→http hop from Google),
 *  else the referrer's host, else "direct". Google Forms links → "google form". */
export function sourceOf(v: { ref?: string; path?: string }): string {
  try {
    const q = new URLSearchParams((v.path ?? "").split("?")[1] ?? "");
    const tag = (q.get("src") || q.get("utm_source") || q.get("ref") || "").trim().toLowerCase();
    if (tag) return tag === "gform" || tag === "googleform" || tag === "form" ? "google form" : tag;
  } catch {
    /* ignore */
  }
  const ref = (v.ref ?? "").toLowerCase();
  if (!ref) return "direct";
  if (ref.includes("docs.google.com") || ref.includes("forms.gle") || ref.includes("/forms/")) return "google form";
  try {
    return new URL(v.ref!).hostname.replace(/^www\./, "");
  } catch {
    return "other";
  }
}

/** Append a single visit as a JSON line. Best-effort — never throws to callers. */
export async function recordVisit(entry: VisitEntry): Promise<void> {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n";
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(LOG_PATH, line);
  } catch (e) {
    console.error("visit log write failed:", e);
  }
}

/** The most recent visits (newest first) for an at-a-glance "anyone been on?" view. */
export async function recentVisits(limit = 25): Promise<Visit[]> {
  try {
    const txt = await readFile(LOG_PATH, "utf8");
    return txt
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((l) => {
        try {
          return JSON.parse(l) as Visit;
        } catch {
          return null;
        }
      })
      .filter((e): e is Visit => e !== null);
  } catch {
    return [];
  }
}

export interface VisitStats {
  total: number;
  today: number;
  uniqueVisitors: number;
  uniqueToday: number;
  byDay: Record<string, number>;
  /** Per-source visit + unique counts, e.g. { "google form": { visits, unique } }. */
  bySource: Record<string, { visits: number; unique: number }>;
}

/** Counts: total + unique visitors (overall and today), per-day, and per-source
 *  (so you can see how many came from the Google Form vs elsewhere). */
export async function visitSummary(): Promise<VisitStats> {
  try {
    const txt = await readFile(LOG_PATH, "utf8");
    const entries = txt
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as Visit;
        } catch {
          return null;
        }
      })
      .filter((e): e is Visit => e !== null);

    const today = new Date().toISOString().slice(0, 10);
    const byDay: Record<string, number> = {};
    const visitors = new Set<string>();
    const visitorsToday = new Set<string>();
    const sourceVisits: Record<string, number> = {};
    const sourceVids: Record<string, Set<string>> = {};
    for (const e of entries) {
      const day = (e.ts ?? "").slice(0, 10);
      if (day) byDay[day] = (byDay[day] ?? 0) + 1;
      if (e.vid) {
        visitors.add(e.vid);
        if (day === today) visitorsToday.add(e.vid);
      }
      const src = sourceOf(e);
      sourceVisits[src] = (sourceVisits[src] ?? 0) + 1;
      (sourceVids[src] ??= new Set()).add(e.vid ?? `_${sourceVisits[src]}`);
    }
    const bySource: Record<string, { visits: number; unique: number }> = {};
    for (const src of Object.keys(sourceVisits)) {
      bySource[src] = { visits: sourceVisits[src], unique: sourceVids[src].size };
    }
    return {
      total: entries.length,
      today: byDay[today] ?? 0,
      uniqueVisitors: visitors.size,
      uniqueToday: visitorsToday.size,
      byDay,
      bySource,
    };
  } catch {
    return { total: 0, today: 0, uniqueVisitors: 0, uniqueToday: 0, byDay: {}, bySource: {} };
  }
}

/** A tiny self-contained HTML dashboard so the owner can just open a link and
 *  see when visitors came and how many unique people there were. */
export async function renderDashboard(): Promise<string> {
  const s = await visitSummary();
  const recent = await recentVisits(40);
  const esc = (v: unknown) => String(v ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
  const days = Object.entries(s.byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const maxDay = Math.max(1, ...days.map(([, n]) => n));

  const stat = (label: string, value: number) =>
    `<div class="card"><div class="num">${value.toLocaleString()}</div><div class="lbl">${label}</div></div>`;

  const dayRows = days
    .map(([d, n]) => `<div class="row"><span class="day">${esc(d)}</span><span class="bar" style="width:${Math.round((n / maxDay) * 100)}%"></span><span class="n">${n}</span></div>`)
    .join("");

  const sources = Object.entries(s.bySource).sort((a, b) => b[1].visits - a[1].visits);
  const maxSrc = Math.max(1, ...sources.map(([, v]) => v.visits));
  const sourceRows = sources
    .map(([name, v]) => {
      const gf = name === "google form";
      return `<div class="row"><span class="src-lbl${gf ? " gf" : ""}">${gf ? "📋 " : ""}${esc(name)}</span><span class="bar" style="width:${Math.round((v.visits / maxSrc) * 100)}%"></span><span class="n">${v.unique} unique · ${v.visits} visits</span></div>`;
    })
    .join("");
  const gf = s.bySource["google form"];

  const recentRows = recent
    .map((r) => {
      const src = sourceOf(r);
      const gfRow = src === "google form";
      return `<tr><td class="t" data-ts="${esc(r.ts)}">${esc(r.ts)}</td><td>${esc(r.path || "/")}</td><td class="src${gfRow ? " gf" : ""}">${gfRow ? "📋 " : ""}${esc(src)}</td></tr>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Market Bubble · Visitors</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#04100c;color:#eafff6;font:14px/1.5 ui-sans-serif,system-ui,"Segoe UI",Roboto}
  .wrap{max-width:860px;margin:0 auto;padding:28px 20px 60px}
  h1{font-size:20px;font-weight:800;letter-spacing:.04em;margin:0 0 2px}
  h1 .b{color:#16e6a4}
  .sub{color:#78b6a4;font-size:12px;margin-bottom:20px}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:26px}
  .card{background:rgba(22,230,164,.06);border:1px solid rgba(22,230,164,.18);border-radius:14px;padding:14px 16px}
  .num{font-size:26px;font-weight:800;color:#16e6a4}
  .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#78b6a4;margin-top:2px}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#78b6a4;margin:24px 0 10px}
  .row{display:flex;align-items:center;gap:10px;margin:5px 0}
  .day{width:92px;color:#cfeee2;font-variant-numeric:tabular-nums}
  .bar{height:14px;background:linear-gradient(90deg,#16e6a4,#34d6ff);border-radius:6px;min-width:3px}
  .n{color:#78b6a4;font-variant-numeric:tabular-nums}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06)}
  th{color:#78b6a4;text-transform:uppercase;font-size:10px;letter-spacing:.08em}
  td.t{font-variant-numeric:tabular-nums;white-space:nowrap;color:#cfeee2}
  td.ref{color:#5e927f;max-width:280px;overflow:hidden;text-overflow:ellipsis}
  td.src{color:#9ec8b9;text-transform:capitalize;white-space:nowrap}
  td.src.gf,.src-lbl.gf{color:#16e6a4;font-weight:700}
  .src-lbl{width:150px;text-transform:capitalize;color:#cfeee2}
  .gfbox{display:flex;align-items:baseline;gap:10px;background:rgba(22,230,164,.08);border:1px solid rgba(22,230,164,.3);border-radius:12px;padding:12px 16px;margin:0 0 8px}
  .gfbox b{font-size:22px;color:#16e6a4}
  .gfbox span{color:#9ec8b9;font-size:12.5px}
  .empty{color:#5e927f;padding:20px 0}
  .foot{margin-top:24px;color:#46685c;font-size:11px}
</style></head>
<body><div class="wrap">
  <h1>Market <span class="b">Bubble</span> · Visitors</h1>
  <div class="sub">All-time cumulative totals — every visitor is counted permanently, even after they leave. The same browser = one unique visitor. Privacy-clean (no IPs / no fingerprinting). Auto-refreshes every 30s.</div>
  <div class="cards">
    ${stat("Unique visitors · all-time", s.uniqueVisitors)}
    ${stat("Total visits · all-time", s.total)}
    ${stat("Unique today", s.uniqueToday)}
    ${stat("Visits today", s.today)}
  </div>
  <h2>📋 From your Google Form</h2>
  <div class="gfbox"><b>${(gf?.unique ?? 0).toLocaleString()}</b><span>unique visitors · ${(gf?.visits ?? 0).toLocaleString()} visits arrived via a <code>?src=gform</code>-tagged link</span></div>
  <h2>Where visitors came from</h2>
  ${sources.length ? sourceRows : '<div class="empty">No visits yet.</div>'}
  <h2>Visits by day</h2>
  ${days.length ? dayRows : '<div class="empty">No visits yet.</div>'}
  <h2>Recent visits</h2>
  ${recent.length ? `<table><thead><tr><th>When (your local time)</th><th>Page</th><th>Source</th></tr></thead><tbody>${recentRows}</tbody></table>` : '<div class="empty">No visits yet.</div>'}
  <div class="foot">Times stored in UTC; shown in your browser's local time.</div>
</div>
<script>
  // localize the UTC timestamps + auto-refresh
  for (const el of document.querySelectorAll("td.t")) {
    const ts = el.getAttribute("data-ts");
    if (ts) { const d = new Date(ts); if (!isNaN(d)) el.textContent = d.toLocaleString(); }
  }
  setTimeout(() => location.reload(), 30000);
</script>
</body></html>`;
}
