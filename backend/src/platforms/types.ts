import type { ChatMessage, ConnectionStatus, ModerationRequest, ModerationResult } from "../../../shared/types.ts";

/**
 * Every platform connector implements this. The hub treats them uniformly:
 * start them, fan their `onMessage` out to all sockets, and route moderation
 * commands back to the right one.
 */
export interface Connector {
  readonly platform: ConnectionStatus["platform"];
  /** Connect to the source and begin emitting messages. */
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): ConnectionStatus;
  /** Execute a moderation command against this platform's API. */
  moderate(req: ModerationRequest): Promise<ModerationResult>;
  /** The hub subscribes here to receive normalized messages. */
  onMessage(cb: (m: ChatMessage) => void): void;
  /** The hub subscribes here to be notified when connection health changes. */
  onStatusChange(cb: (s: ConnectionStatus) => void): void;
}

/** Small helper base that handles the listener plumbing. */
export abstract class BaseConnector implements Connector {
  abstract readonly platform: ConnectionStatus["platform"];
  protected messageCb: (m: ChatMessage) => void = () => {};
  protected statusCb: (s: ConnectionStatus) => void = () => {};
  protected _status: ConnectionStatus;

  constructor(platform: ConnectionStatus["platform"], channel?: string) {
    this._status = { platform, connected: false, channel };
  }

  onMessage(cb: (m: ChatMessage) => void) { this.messageCb = cb; }
  onStatusChange(cb: (s: ConnectionStatus) => void) { this.statusCb = cb; }
  status() { return this._status; }

  protected setStatus(patch: Partial<ConnectionStatus>) {
    this._status = { ...this._status, ...patch };
    this.statusCb(this._status);
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract moderate(req: ModerationRequest): Promise<ModerationResult>;
}
