/**
 * Market Bubble — shared types.
 * The single source of truth for the message/layout/theme contracts that
 * both the backend (normalizers) and frontend (renderers) agree on.
 */

/** The live chat sources we aggregate. Add more here and the UI follows. */
export type Platform = "twitch" | "kick" | "x" | "youtube";

/** @deprecated alias — every platform is first-class now. */
export type ExtPlatform = Platform;

/**
 * A single connected channel/account. Multiple accounts per platform are
 * aggregated into one feed (e.g. Ansem + Banks + Market Bubble on Twitch).
 */
export interface Account {
  /** Stable unique id, e.g. `twitch:ansem`. */
  id: string;
  platform: Platform;
  /** Channel/handle used to connect, e.g. "ansem". */
  handle: string;
  /** Friendly label shown in the UI, e.g. "Ansem". */
  displayName: string;
  connected: boolean;
}

/** A single normalized chat message — every connector MUST emit this shape. */
export interface ChatMessage {
  /** Globally-unique id: `${platform}:${nativeId}` so we never collide. */
  id: string;
  platform: Platform;
  /** Which connected account/channel this message came from (Account.id). */
  accountId?: string;
  /** Friendly source channel label, e.g. "Ansem". */
  channel?: string;
  /** Display name as shown in the source chat. */
  username: string;
  /** Raw message text (emotes still as :codes: — frontend resolves them). */
  message: string;
  /** Unix epoch ms. */
  timestamp: number;
  /** Hex color the platform assigned to the user (optional). */
  color?: string;
  /** Avatar URL if the platform exposes one. */
  avatar?: string;
  /** Platform badges (mod, sub, vip, broadcaster, verified...). */
  badges?: Badge[];
  /** Resolved emotes for inline rendering. */
  emotes?: Emote[];
  /** True if our heuristics flagged this as a "hype" message (donations, raids, big subs). */
  hype?: boolean;
  /** Monetization event attached to this message (tip, bits, sub, gift), if any. */
  event?: ChatEvent;
  /** Native per-platform id, kept for moderation calls. */
  nativeId?: string;
}

/**
 * A monetary / subscription event on a message. Drives the donor + sub
 * leaderboards. Backend connectors should populate this from native events
 * (Twitch bits/subs/gifts, Kick gifts, X/StreamElements tips, etc.).
 */
export interface ChatEvent {
  kind: "donation" | "bits" | "subscription" | "gift";
  /** USD-equivalent value, used to rank top donors. */
  amount: number;
  /** Number of subs conveyed (1 for a sub, N for a gift-bomb). Defaults to 1. */
  count?: number;
  /** Human label, e.g. "$50", "100 bits", "Tier 3", "5× gifted". */
  label: string;
}

export interface Badge {
  type: "broadcaster" | "moderator" | "subscriber" | "vip" | "verified" | "founder" | "og";
  label: string;
}

export interface Emote {
  code: string;
  url: string;
}

/** Per-platform live connection state, surfaced as status pills in the UI. */
export interface ConnectionStatus {
  platform: Platform;
  connected: boolean;
  channel?: string;
  latencyMs?: number;
  error?: string;
}

/* ----------------------------------- Stats ----------------------------------- *
 *
 * BACKEND CONTRACT (Codex): emit `stats` over the socket on a ~2s cadence.
 *
 * The frontend computes everything it can see from the message firehose itself
 * (uniqueChatters, messages, messagesPerMin, sentiment, top chatters, clip
 * moments) so those work even before the backend ships. The backend is the
 * ONLY source for fields the chat stream can't reveal — marked [BACKEND] below.
 * Fields the frontend already derives are marked [DERIVED] and may be sent as
 * authoritative overrides if the backend has better numbers.
 */
export interface PlatformStats {
  platform: Platform;
  /** [BACKEND] Live concurrent viewers from the platform API. */
  viewers: number;
  /** [BACKEND] Session peak concurrent viewers (high-water mark). */
  peakViewers: number;
  /** [BACKEND] Cumulative viewer-minutes this session (Σ viewers · elapsed). */
  watchTimeMinutes: number;
  /** [BACKEND] Followers/subscribers gained this session (momentum). */
  followsGained?: number;
  /** [DERIVED] Distinct users who have chatted this session. */
  uniqueChatters: number;
  /** [DERIVED] Chatters active in the last 5 minutes. */
  activeChatters: number;
  /** [DERIVED] Total chat messages this session. */
  messages: number;
  /** [DERIVED] Current chat velocity, messages/minute. */
  messagesPerMin: number;
}

/** A single stats snapshot covering every connected platform. */
export interface AggregateStats {
  /** Epoch ms the aggregator/session started (for elapsed + watch-time math). */
  sessionStart: number;
  /** Epoch ms of this snapshot. */
  updatedAt: number;
  perPlatform: PlatformStats[];
}

/* ------------------------------- Stream history ------------------------------ *
 *
 * BACKEND CONTRACT (Codex): persist one StreamSession per completed broadcast
 * (roll up the per-2s stats over the stream) and send the list on connect via
 * the `history` event. The frontend renders the analytics tab from these plus a
 * synthetic "live" session built from the in-progress stats.
 */
export interface PlatformKPIs {
  platform: Platform;
  avgViewers: number;
  peakViewers: number;
  uniqueChatters: number;
  messages: number;
  /** Viewer-minutes (Σ viewers · time). */
  watchTimeMinutes: number;
  /** USD-equivalent raised. */
  donated: number;
  subs: number;
  followersGained: number;
}

/** Per-account KPI breakdown so analytics can filter by individual channel. */
export interface AccountKPIs extends PlatformKPIs {
  accountId: string;
  displayName: string;
}

export interface StreamSession {
  id: string;
  title: string;
  /** Epoch ms the stream started. */
  startedAt: number;
  durationMinutes: number;
  /** True only for the in-progress session synthesized on the client. */
  live?: boolean;
  /* aggregate KPIs across all platforms */
  avgViewers: number;
  peakViewers: number;
  uniqueChatters: number;
  messages: number;
  watchTimeMinutes: number;
  donated: number;
  subs: number;
  followersGained: number;
  clipMoments: number;
  perPlatform: PlatformKPIs[];
  /** Per-account breakdown (Ansem, Banks, …) for the analytics account filter. */
  perAccount?: AccountKPIs[];
}

/**
 * The numeric KPI fields shared by StreamSession, PlatformKPIs, and AccountKPIs.
 * Derived from PlatformKPIs (minus `platform`) so it can never drift from the
 * data, and lets analytics index any of the three generically while staying
 * fully type-checked — no `Record<string, number>` casts.
 */
export type KpiKey = keyof Omit<PlatformKPIs, "platform">;

/* --------------------------------- Moderation -------------------------------- */

export type ModerationAction =
  | { kind: "delete" }
  | { kind: "timeout"; seconds: number }
  | { kind: "ban" }
  | { kind: "unban" }
  | { kind: "slow"; seconds: number };

export interface ModerationRequest {
  platform: ExtPlatform;
  /** The message being acted on (for delete/timeout context). */
  messageId?: string;
  /** Target username (for ban/timeout). */
  username?: string;
  action: ModerationAction;
}

export interface ModerationResult {
  ok: boolean;
  request: ModerationRequest;
  error?: string;
  /** Opaque token the UI can send back to undo, when the platform supports it. */
  undoToken?: string;
}

/* ----------------------------------- Layout ---------------------------------- */

/** A panel placed on the editor canvas. Geometry is in grid units. */
export interface PanelLayout {
  /** react-grid-layout item id. */
  i: string;
  /** Which widget this panel renders. */
  widget: WidgetKind;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  /** Per-panel config (e.g. which platforms a feed shows). */
  props?: Record<string, unknown>;
}

export type WidgetKind =
  | "chat-feed"
  | "stats"
  | "connection-status"
  | "button-deck"
  | "hype-meter"
  | "mood-meter"
  | "clip-radar"
  | "top-chatters"
  | "giveaway"
  | "clips"
  | "user-list"
  | "stream-preview"
  | "ops"
  | "polymarket";

export interface Layout {
  version: 1;
  panels: PanelLayout[];
}

/* ----------------------------------- Theme ----------------------------------- */

export interface Theme {
  name: string;
  /** Page background. */
  bg: string;
  /** Panel/glass surface tint. */
  surface: string;
  /** Primary accent (neon). */
  accent: string;
  /** Secondary accent. */
  accent2: string;
  text: string;
  textMuted: string;
  /** 0–1, drives box-shadow spread + bloom. */
  glow: number;
  /** Corner radius in px. */
  radius: number;
  font: "Inter" | "Space Grotesk" | "JetBrains Mono" | "Geist";
  bubbleStyle: "flat" | "glass" | "outline";
  /** Selectable style templates (Theme Editor). Optional → back-compat. */
  tile?: TileTemplate;
  btn?: ButtonTemplate;
  btnFx?: ButtonEffect;
  textStyle?: TextTemplate;
}

export type ButtonEffect =
  | "none" | "lift" | "glow" | "halo" | "pop" | "press"
  | "sheen" | "sweep" | "fill" | "pulse" | "ring" | "underline" | "spin";

export type TileTemplate =
  | "glass" | "flat" | "outline" | "elevated" | "neon"
  | "frosted" | "inset" | "gradient" | "holo" | "line";
export type ButtonTemplate =
  | "solid" | "pill" | "soft" | "sharp" | "square"
  | "bold" | "caps" | "ring" | "glow" | "mono";
export type TextTemplate =
  | "default" | "tight" | "wide" | "heavy" | "light" | "mono" | "soft" | "crisp" | "serif";

/* ----------------------------------- Clips ----------------------------------- */

/** One line of captured chat context inside a clip. */
export interface ClipContextLine {
  platform: Platform;
  username: string;
  message: string;
}

/**
 * A captured moment. The frontend always saves the *chat-side* context (the
 * surrounding messages + viewer counts at that instant) so a clip is meaningful
 * even with no video. The backend (Codex) can additionally call the platform's
 * native clip API (Twitch Clips, Kick clips) and fill `externalUrl`.
 */
export interface Clip {
  id: string;
  createdAt: number; // epoch ms
  label: string;
  reason: "manual" | "auto-radar";
  /** Live viewer counts per platform at capture time. */
  viewers: Partial<Record<Platform, number>>;
  /** Surrounding chat messages, oldest → newest. */
  context: ClipContextLine[];
  /** Set once a platform-native clip has been created server-side. */
  externalUrl?: string;
  /** Which platform the native clip should be cut from (if any). */
  sourcePlatform?: Platform;
}

/* --------------------------------- Giveaway ---------------------------------- */

export interface GiveawayEntrant {
  platform: Platform;
  username: string;
  at: number; // epoch ms they entered
}

export interface GiveawayConfig {
  /** Keyword that enters a viewer, e.g. "!enter" / "!giveaway". */
  keyword: string;
  /** Prize description shown in the UI. */
  prize: string;
  /** One entry per user (true) or allow repeats (false). */
  uniqueOnly: boolean;
}

/* ----------------------------------- Overlay --------------------------------- */

export type OverlaySource =
  | "twitch"
  | "kick"
  | "x"
  | "youtube"
  | "combined"
  | "chat"
  | "market";

/** A Polymarket market pinned to the overlay. */
export interface OverlayMarketData {
  id: string;
  question: string;
  outcome: string;
  /** Probability 0..1 of `outcome`. */
  prob: number;
  volume24h: number;
  category: string;
}

/**
 * A free-positioned overlay element. Most sources render a viewer-count badge;
 * `chat` renders a live unified-chat panel and `market` a Polymarket card
 * (both sized by `w`/`h`).
 */
export interface OverlayElement {
  id: string;
  source: OverlaySource;
  /** Position in viewport pixels (top-left origin). */
  x: number;
  y: number;
  scale: number;
  showLabel: boolean;
  visible: boolean;
  /** Panel size in px — used by `chat` and `market`. */
  w?: number;
  h?: number;
  /** Market payload — only set when source === "market". */
  market?: OverlayMarketData;
}

/* -------------------------- Custom action buttons ---------------------------- */

/** A user-authored action button created in the Button Editor. */
export interface ActionButton {
  id: string;
  label: string;
  /** Lucide icon name, resolved at render time. */
  icon?: string;
  color: string;
  /** Which platforms this command fires against. */
  platforms: Platform[];
  /** Command template, e.g. "/raid {target}" or a moderation macro. */
  command: string;
}

/* -------------------------- Socket.io event contract ------------------------- */

export interface ServerToClientEvents {
  message: (msg: ChatMessage) => void;
  status: (statuses: ConnectionStatus[]) => void;
  /** [BACKEND] Periodic stats snapshot (~2s cadence). See AggregateStats. */
  stats: (stats: AggregateStats) => void;
  "moderation:result": (result: ModerationResult) => void;
  /** [BACKEND] A native platform clip finished cutting; carries its public URL. */
  "clip:created": (clipId: string, externalUrl: string) => void;
  /** [BACKEND] Past stream sessions for the analytics tab (sent on connect). */
  history: (sessions: StreamSession[]) => void;
  /** [BACKEND] Connected accounts after OAuth (live mode), pushed on change. */
  accounts: (accounts: Account[]) => void;
}

export interface ClientToServerEvents {
  moderate: (req: ModerationRequest) => void;
  "command:run": (button: ActionButton, target?: string) => void;
  /** [BACKEND] Ask the server to cut a native platform clip for this moment. */
  "clip:create": (clip: Clip) => void;
  /**
   * A signed-in viewer posts into the shared unified chat. `token` is the
   * HMAC-signed X identity the backend issued at "Login with X" (sanctioned
   * OAuth — never the broadcast scrape). The server verifies it, rate-limits,
   * and fans the message out to everyone as a normal `message`.
   */
  chat: (req: { token: string; text: string }) => void;
}
