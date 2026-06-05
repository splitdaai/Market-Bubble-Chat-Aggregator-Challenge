import type { ModerationRequest, ModerationResult } from "@shared/types";
import { getSocket } from "./socket";

/**
 * Moderation proxy client. Fires the command at the backend over the socket
 * when connected; in mock mode it resolves optimistically so the UX (confirm
 * toast + undo) is fully exercisable without real OAuth scopes.
 */
export function moderate(req: ModerationRequest): Promise<ModerationResult> {
  const socket = getSocket();
  if (!socket) {
    // Mock: pretend the platform accepted it.
    return Promise.resolve({
      ok: true,
      request: req,
      undoToken: req.action.kind === "ban" ? `undo-${Date.now()}` : undefined,
    });
  }
  return new Promise((resolve) => {
    const timeout = window.setTimeout(
      () => resolve({ ok: false, request: req, error: "timeout" }),
      6000,
    );
    socket.once("moderation:result", (result) => {
      window.clearTimeout(timeout);
      resolve(result);
    });
    socket.emit("moderate", req);
  });
}
