import type { Connector } from "./platforms/types.ts";
import type { ModerationRequest, ModerationResult } from "../../shared/types.ts";

/**
 * Routes a moderation request to the connector for its platform. This is the
 * single choke point the socket layer calls — keeps the proxy logic in one
 * place and guarantees we never fire a command at the wrong platform.
 */
export function makeModerationRouter(connectors: Map<string, Connector>) {
  return async function moderate(req: ModerationRequest): Promise<ModerationResult> {
    const connector = connectors.get(req.platform);
    if (!connector) {
      return { ok: false, request: req, error: `no_connector_for_${req.platform}` };
    }
    return connector.moderate(req);
  };
}
