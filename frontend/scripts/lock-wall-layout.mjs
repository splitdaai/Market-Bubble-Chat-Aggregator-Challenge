#!/usr/bin/env node
/**
 * 🔒 WALL LAYOUT LOCK (Eddie, 2026-07-05).
 *
 * The embedded (Return to Memes wall) SimpleApp layout is LOCKED — Eddie approved
 * exactly this look (top-aligned video, chat rail, single 145px footer wordmark,
 * no dead space) after it regressed several times. Do NOT change these without his
 * EXPRESS CONSENT; if he approves, update the expected values here in the SAME
 * commit. Runs as `prebuild`, so `npm run build` (and therefore the Vercel deploy)
 * FAILS if any of these drift.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (p) => readFileSync(join(src, p), "utf8");
const fail = (msg) => {
  console.error("\n🔒 WALL LAYOUT LOCK VIOLATION\n" + msg +
    "\n\nThis embedded wall layout is locked (Eddie's sign-off, 2026-07-05). If he EXPRESSLY\n" +
    "approved a change, update the check in frontend/scripts/lock-wall-layout.mjs in the same commit.\n");
  process.exit(1);
};
const must = (cond, msg) => { if (!cond) fail(msg); };

const simple = read("components/SimpleApp.tsx");
must(/if \(IS_EMBEDDED && \(kind === "stream-preview" \|\| kind === "chat-feed"\)\) h = 14;/.test(simple), "embedded tile height is not the locked 14 rows.");
must(/height: 145,/.test(simple) && /market-bubble-logo\.svg/.test(simple), "footer wordmark is not the locked 145px market-bubble-logo.svg.");
must(/pageKey=\{IS_EMBEDDED \? "simple-wall-v1"/.test(simple), "embedded PageGrid layout key is not the locked simple-wall-v1.");
must(/\{!IS_EMBEDDED && \(\n\s*<header/.test(simple), "the header is no longer hidden in embedded mode.");

const stream = read("components/widgets/StreamPreview.tsx");
must(/IS_EMBEDDED \? "items-start"/.test(stream), "embedded video is not top-aligned (items-start).");
must(!/IS_EMBEDDED \? "flex-col/.test(stream), "embedded video container uses flex-col again — that reintroduces the dead-space-above regression. Use items-start.");

console.log("🔒 wall layout lock OK — top-align + 14-row tiles + 145px wordmark + simple-wall-v1 intact.");
