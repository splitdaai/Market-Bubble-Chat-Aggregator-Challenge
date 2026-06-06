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
}

/** Counts: total + unique visitors (overall and today), and per-day, so you can
 *  see how many people came and when. */
export async function visitSummary(): Promise<VisitStats> {
  try {
    const txt = await readFile(LOG_PATH, "utf8");
    const entries = txt
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as { ts?: string; vid?: string };
        } catch {
          return null;
        }
      })
      .filter((e): e is { ts?: string; vid?: string } => e !== null);

    const today = new Date().toISOString().slice(0, 10);
    const byDay: Record<string, number> = {};
    const visitors = new Set<string>();
    const visitorsToday = new Set<string>();
    for (const e of entries) {
      const day = (e.ts ?? "").slice(0, 10);
      if (day) byDay[day] = (byDay[day] ?? 0) + 1;
      if (e.vid) {
        visitors.add(e.vid);
        if (day === today) visitorsToday.add(e.vid);
      }
    }
    return {
      total: entries.length,
      today: byDay[today] ?? 0,
      uniqueVisitors: visitors.size,
      uniqueToday: visitorsToday.size,
      byDay,
    };
  } catch {
    return { total: 0, today: 0, uniqueVisitors: 0, uniqueToday: 0, byDay: {} };
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

  const recentRows = recent
    .map((r) => `<tr><td class="t" data-ts="${esc(r.ts)}">${esc(r.ts)}</td><td>${esc(r.path || "/")}</td><td class="ref">${esc(r.ref || "—")}</td></tr>`)
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
  .empty{color:#5e927f;padding:20px 0}
  .foot{margin-top:24px;color:#46685c;font-size:11px}
</style></head>
<body><div class="wrap">
  <h1>Market <span class="b">Bubble</span> · Visitors</h1>
  <div class="sub">Privacy-clean — anonymous counts only, no IPs or fingerprinting. Auto-refreshes every 30s.</div>
  <div class="cards">
    ${stat("Unique visitors", s.uniqueVisitors)}
    ${stat("Total visits", s.total)}
    ${stat("Unique today", s.uniqueToday)}
    ${stat("Visits today", s.today)}
  </div>
  <h2>Visits by day</h2>
  ${days.length ? dayRows : '<div class="empty">No visits yet.</div>'}
  <h2>Recent visits</h2>
  ${recent.length ? `<table><thead><tr><th>When (your local time)</th><th>Page</th><th>Came from</th></tr></thead><tbody>${recentRows}</tbody></table>` : '<div class="empty">No visits yet.</div>'}
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
