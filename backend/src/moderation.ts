import type { Connector } from "./platforms/types.ts";
import type { ModerationRequest, ModerationResult } from "../../shared/types.ts";

/**
 * Routes a moderation request to the connector for its platform. This is the
 * single choke point the socket layer calls — keeps the proxy logic in one
 * place and guarantees we never fire a command at the wrong platform.
 */
export function makeModerationRouter(connectors: Map<string, Connector>) {
  return async function moderate(req: ModerationRequest): Promise<ModerationResult> {
    // The registry is keyed by platform:channel (multi-account). Prefer the
    // connector for the message's source channel, then fall back to platform.
    const requestedChannel = normalizeChannel(req.channel);
    const connector = [...connectors.values()].find((c) =>
      c.platform === req.platform &&
      requestedChannel &&
      normalizeChannel(c.status().channel) === requestedChannel,
    ) ?? [...connectors.values()].find((c) => c.platform === req.platform);
    if (!connector) {
      return { ok: false, request: req, error: `no_connector_for_${req.platform}` };
    }
    return connector.moderate(req);
  };
}

function normalizeChannel(channel: unknown): string | null {
  if (typeof channel !== "string") return null;
  const clean = channel.trim().replace(/^[@#]/, "").toLowerCase();
  return clean || null;
}
