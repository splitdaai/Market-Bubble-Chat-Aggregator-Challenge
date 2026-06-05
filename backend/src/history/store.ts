import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { StreamSession } from "../../../shared/types.ts";

const FILE = process.env.HISTORY_FILE ?? "data/history.json";

/**
 * Dead-simple JSON-file store for completed stream sessions. Swap for a real DB
 * later — the interface (load / all / add) is all the hub needs. Sent to clients
 * via the `history` event on connect.
 */
export class HistoryStore {
  private sessions: StreamSession[] = [];

  load(): void {
    try {
      if (existsSync(FILE)) this.sessions = JSON.parse(readFileSync(FILE, "utf8"));
    } catch (e) {
      console.error("history load failed:", e);
    }
  }

  all(): StreamSession[] {
    return this.sessions;
  }

  add(session: StreamSession): void {
    this.sessions.push(session);
    try {
      mkdirSync(dirname(FILE), { recursive: true });
      writeFileSync(FILE, JSON.stringify(this.sessions, null, 2));
    } catch (e) {
      console.error("history save failed:", e);
    }
  }
}
