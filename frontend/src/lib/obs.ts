/**
 * Minimal OBS WebSocket v5 client (https://github.com/obsproject/obs-websocket).
 *
 * Connects straight from the browser to a local OBS instance, performs the
 * SHA-256 challenge/response auth, and exposes request calls. We use it to drop
 * the Market Bubble viewer overlay into OBS as a Browser Source in one click.
 *
 * The password is passed in per-connect and never stored.
 */

async function sha256b64(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export interface ObsClient {
  call: (requestType: string, requestData?: unknown) => Promise<any>;
  disconnect: () => void;
  version: string;
}

interface Pending {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
}

/** Connect + identify. Resolves once OBS has accepted us (op 2). */
export function connectObs(host: string, port: number, password: string): Promise<ObsClient> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${host}:${port}`);
    } catch (e) {
      reject(new Error(`Bad address: ${e}`));
      return;
    }

    const pending = new Map<string, Pending>();
    let reqSeq = 0;
    let version = "";
    let settled = false;

    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws.close(); } catch { /* noop */ }
        reject(new Error("Timed out — is OBS running with WebSocket enabled (Tools → WebSocket Server Settings)?"));
      }
    }, 8000);

    const client: ObsClient = {
      version: "",
      disconnect: () => { try { ws.close(); } catch { /* noop */ } },
      call: (requestType, requestData) =>
        new Promise((res, rej) => {
          const requestId = `r${++reqSeq}`;
          pending.set(requestId, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
        }),
    };

    ws.onmessage = async (ev) => {
      let msg: { op: number; d: any };
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.op === 0) {
        // Hello — authenticate if the server requires it.
        version = msg.d.obsWebSocketVersion ?? "";
        const identify: any = { rpcVersion: 1 };
        const auth = msg.d.authentication;
        if (auth) {
          const secret = await sha256b64(password + auth.salt);
          identify.authentication = await sha256b64(secret + auth.challenge);
        }
        ws.send(JSON.stringify({ op: 1, d: identify }));
      } else if (msg.op === 2) {
        // Identified — connection ready.
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          client.version = version;
          resolve(client);
        }
      } else if (msg.op === 7) {
        // RequestResponse
        const p = pending.get(msg.d.requestId);
        if (p) {
          pending.delete(msg.d.requestId);
          if (msg.d.requestStatus?.result) p.resolve(msg.d.responseData ?? {});
          else p.reject(new Error(msg.d.requestStatus?.comment ?? "OBS request failed"));
        }
      }
    };

    ws.onerror = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error("Could not reach OBS. Check the host/port and that WebSocket Server is enabled."));
      }
    };

    ws.onclose = (ev) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error(ev.code === 1006 ? "Connection refused — OBS not reachable at that address." : `Closed (${ev.code})`));
      }
    };
  });
}

/** Add the Market Bubble viewer overlay to OBS as a Browser Source. */
export async function addOverlaySource(client: ObsClient, url: string): Promise<void> {
  const scene = await client.call("GetCurrentProgramScene");
  const sceneName = scene.currentProgramSceneName ?? scene.sceneName;
  await client.call("CreateInput", {
    sceneName,
    inputName: `Market Bubble Overlay ${Math.floor(Date.now() / 1000) % 10000}`,
    inputKind: "browser_source",
    inputSettings: { url, width: 1920, height: 1080 },
    sceneItemEnabled: true,
  });
}
