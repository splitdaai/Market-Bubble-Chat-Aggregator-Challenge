// CORS-safe proxy for one chat history page: the pscp.tv history endpoint is a
// cross-origin POST browsers can't make directly. Endpoint host is allowlisted
// to *.pscp.tv so this can't be used as an open proxy.
import type { IncomingMessage, ServerResponse } from "node:http";
import { isPscpEndpoint, replayChatPage } from "./_xchat.js";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 8_192) reject(new Error("too large")); });
    req.on("end", () => resolve(s));
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "post only" })); }
    const body = JSON.parse((await readBody(req)) || "{}") as { endpoint?: string; accessToken?: string; cursor?: string };
    if (!body.endpoint || !body.accessToken || !isPscpEndpoint(body.endpoint)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "bad endpoint" }));
    }
    const page = await replayChatPage(body.endpoint, body.accessToken, typeof body.cursor === "string" ? body.cursor : "");
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 200;
    res.end(JSON.stringify(page));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "history failed" }));
  }
}
