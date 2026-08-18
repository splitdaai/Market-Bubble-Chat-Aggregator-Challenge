// Shared YouTube live-chat helpers for the serverless functions — $0, no API key,
// no daily quota. Same idea as _xchat.ts: the browser can't call YouTube's
// internal ("InnerTube") endpoints directly (CORS), so this thin proxy does two
// stateless jobs and the browser keeps the cursor between polls:
//   1. resolve  — @handle (or channel URL / video id) → the currently-live video
//                 + the first live-chat continuation token
//   2. poll     — continuation → new messages + next continuation + timeoutMs
// Everything is public data (guest access, no login), exactly what the YouTube
// site itself fetches for a signed-out viewer.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  "Accept-Language": "en-US,en;q=0.9",
  // Skips the EU consent interstitial + keeps the signed-out web layout.
  Cookie: "CONSENT=YES+cb.20240101-00-p0.en+FX+000; SOCS=CAI; PREF=hl=en&gl=US",
};
// Public web-client key (baked into every youtube.com page). We still read the
// live one from the page and only fall back to this.
const FALLBACK_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const FALLBACK_CLIENT_VERSION = "2.20240814.00.00";

export const HANDLE_RE = /^@?[A-Za-z0-9._-]{3,30}$/;
export const VIDEO_RE = /^[A-Za-z0-9_-]{11}$/;
export const CHANNEL_RE = /^UC[A-Za-z0-9_-]{22}$/;

export interface YtBadge { type: "broadcaster" | "moderator" | "subscriber" | "verified"; label: string }
export interface YtMsg {
  id: string;
  author: string;
  authorChannelId?: string;
  avatar?: string;
  text: string;
  /** ms epoch */
  t: number;
  badges: YtBadge[];
  /** Super Chat / Super Sticker purchase, e.g. "$5.00" */
  amount?: string;
  /** "text" | "superchat" | "supersticker" | "member" */
  kind: "text" | "superchat" | "supersticker" | "member";
}
export interface YtResolve {
  live: boolean;
  videoId?: string;
  title?: string;
  channelName?: string;
  continuation?: string;
  apiKey?: string;
  clientVersion?: string;
  /** when not live: how long the browser should wait before asking again */
  retryMs?: number;
}
export interface YtPoll {
  messages: YtMsg[];
  continuation?: string;
  timeoutMs: number;
  /** false once the chat/stream is over */
  live: boolean;
}

/** Turn whatever the user pasted into a fetchable "find the live video" URL. */
export function targetUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (VIDEO_RE.test(s)) return `https://www.youtube.com/watch?v=${s}`;
  if (CHANNEL_RE.test(s)) return `https://www.youtube.com/channel/${s}/live`;
  if (HANDLE_RE.test(s)) return `https://www.youtube.com/@${s.replace(/^@/, "")}/live`;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return null;
    if (u.hostname.endsWith("youtu.be")) {
      const id = u.pathname.slice(1);
      return VIDEO_RE.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
    }
    const v = u.searchParams.get("v");
    if (v && VIDEO_RE.test(v)) return `https://www.youtube.com/watch?v=${v}`;
    const m = u.pathname.match(/^\/(?:live\/)?([A-Za-z0-9_-]{11})$/);
    if (m && u.pathname.startsWith("/live/")) return `https://www.youtube.com/watch?v=${m[1]}`;
    const h = u.pathname.match(/^\/(@[A-Za-z0-9._-]{3,30})/);
    if (h) return `https://www.youtube.com/${h[1]}/live`;
    const c = u.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})/);
    if (c) return `https://www.youtube.com/channel/${c[1]}/live`;
    const legacy = u.pathname.match(/^\/(?:c|user)\/([A-Za-z0-9._-]{2,40})/);
    if (legacy) return `https://www.youtube.com/${legacy[0].slice(1)}/live`;
  } catch { /* not a url */ }
  return null;
}

function pick(re: RegExp, html: string): string | undefined {
  const m = html.match(re);
  return m ? m[1] : undefined;
}

/** `var ytInitialData = {...};` → parsed object (or null). */
function initialData(html: string): unknown {
  const m = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// Walk the watch page's ytInitialData for the live-chat continuation. Prefer the
// "Live chat" (all messages) view over the default "Top chat" filter.
function findLiveChatContinuation(data: unknown): string | undefined {
  const d = data as {
    contents?: { twoColumnWatchNextResults?: { conversationBar?: { liveChatRenderer?: {
      continuations?: { reloadContinuationData?: { continuation?: string } }[];
      header?: { liveChatHeaderRenderer?: { viewSelector?: { sortFilterSubMenuRenderer?: {
        subMenuItems?: { title?: string; selected?: boolean; continuation?: { reloadContinuationData?: { continuation?: string } } }[];
      } } } };
    } } } };
  };
  const r = d?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer;
  if (!r) return undefined;
  // The renderer's own continuation is the real, self-contained chat cursor
  // (~180 chars, carries the video id). The Top chat / Live chat toggle items
  // sometimes carry short 32-char stubs that InnerTube rejects — only take the
  // "Live chat" (all messages) one when it's a full cursor.
  const items = r.header?.liveChatHeaderRenderer?.viewSelector?.sortFilterSubMenuRenderer?.subMenuItems ?? [];
  const all = items.find((i) => /^live chat$/i.test(i.title ?? ""))?.continuation?.reloadContinuationData?.continuation;
  if (all && all.length > 60) return all;
  const own = r.continuations?.[0]?.reloadContinuationData?.continuation;
  if (own && own.length > 60) return own;
  return undefined;
}

/** Resolve a handle / channel / video to the live video + first chat cursor. */
export async function resolveLive(input: string): Promise<YtResolve | null> {
  const url = targetUrl(input);
  if (!url) return null;
  const r = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (!r.ok) return { live: false, retryMs: 60_000 };
  const html = await r.text();

  // The /live URL 302s to /watch?v=… only while the channel is live (or has a
  // scheduled premiere). Off-air it lands back on the channel page.
  const canonical = pick(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/, html);
  const isLive = /"isLiveNow"\s*:\s*true/.test(html) || /"isLive"\s*:\s*true/.test(html);
  const title = pick(/<meta name="title" content="([^"]*)"/, html)?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const channelName = pick(/"ownerChannelName"\s*:\s*"((?:[^"\\]|\\.)*)"/, html)?.replace(/\\"/g, '"');
  const apiKey = pick(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/, html) ?? FALLBACK_KEY;
  const clientVersion = pick(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/, html) ?? FALLBACK_CLIENT_VERSION;

  if (!canonical || !isLive) return { live: false, retryMs: 60_000, title, channelName };
  // Fallback = the first "continuation" in the page, which is the chat cursor
  // on a live watch page; guard against short non-chat stubs.
  const first = pick(/"continuation"\s*:\s*"([^"]{60,})"/, html);
  const continuation = findLiveChatContinuation(initialData(html)) ?? first;
  if (!continuation) return { live: false, retryMs: 30_000, videoId: canonical, title, channelName };
  return { live: true, videoId: canonical, title, channelName, continuation, apiKey, clientVersion };
}

type Runs = { runs?: { text?: string; emoji?: { emojiId?: string; shortcuts?: string[]; isCustomEmoji?: boolean; image?: { accessibility?: { accessibilityData?: { label?: string } } } } }[]; simpleText?: string };
function runsToText(r?: Runs): string {
  if (!r) return "";
  if (r.simpleText) return r.simpleText;
  return (r.runs ?? [])
    .map((x) => {
      if (x.text) return x.text;
      const e = x.emoji;
      if (!e) return "";
      // Unicode emoji come through as their character; custom channel emoji as :shortcut:
      if (!e.isCustomEmoji && e.emojiId && e.emojiId.length <= 8) return e.emojiId;
      return e.shortcuts?.[0] ?? e.image?.accessibility?.accessibilityData?.label ?? "";
    })
    .join("");
}

interface Renderer {
  id?: string;
  timestampUsec?: string;
  authorName?: Runs;
  authorExternalChannelId?: string;
  authorPhoto?: { thumbnails?: { url?: string }[] };
  authorBadges?: { liveChatAuthorBadgeRenderer?: { tooltip?: string; icon?: { iconType?: string }; customThumbnail?: unknown } }[];
  message?: Runs;
  purchaseAmountText?: Runs;
  headerSubtext?: Runs;
}

function badgesOf(r: Renderer): YtBadge[] {
  const out: YtBadge[] = [];
  for (const b of r.authorBadges ?? []) {
    const br = b.liveChatAuthorBadgeRenderer;
    if (!br) continue;
    const icon = br.icon?.iconType ?? "";
    const tip = br.tooltip ?? "";
    if (icon === "OWNER") out.push({ type: "broadcaster", label: "Owner" });
    else if (icon === "MODERATOR") out.push({ type: "moderator", label: "Mod" });
    else if (icon === "VERIFIED") out.push({ type: "verified", label: "Verified" });
    else if (br.customThumbnail || /member/i.test(tip)) out.push({ type: "subscriber", label: tip || "Member" });
  }
  return out;
}

function toMsg(item: Record<string, Renderer>): YtMsg | null {
  const text = item.liveChatTextMessageRenderer;
  const paid = item.liveChatPaidMessageRenderer;
  const sticker = item.liveChatPaidStickerRenderer;
  const member = item.liveChatMembershipItemRenderer;
  const r = text ?? paid ?? sticker ?? member;
  if (!r || !r.id) return null;
  const author = runsToText(r.authorName);
  if (!author) return null;
  const kind: YtMsg["kind"] = text ? "text" : paid ? "superchat" : sticker ? "supersticker" : "member";
  const body = runsToText(r.message) || (member ? runsToText(r.headerSubtext) : "") || (sticker ? "sent a Super Sticker" : "");
  if (!body && kind === "text") return null;
  return {
    id: r.id,
    author,
    authorChannelId: r.authorExternalChannelId,
    avatar: r.authorPhoto?.thumbnails?.[0]?.url,
    text: body,
    t: r.timestampUsec ? Math.floor(Number(r.timestampUsec) / 1000) : Date.now(),
    badges: badgesOf(r),
    amount: runsToText(r.purchaseAmountText) || undefined,
    kind,
  };
}

/** One poll of the live chat. Stateless — the caller round-trips `continuation`. */
export async function pollChat(continuation: string, apiKey = FALLBACK_KEY, clientVersion = FALLBACK_CLIENT_VERSION): Promise<YtPoll> {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${encodeURIComponent(apiKey)}&prettyPrint=false`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json", Origin: "https://www.youtube.com", Referer: "https://www.youtube.com/" },
    body: JSON.stringify({ context: { client: { hl: "en", gl: "US", clientName: "WEB", clientVersion } }, continuation }),
  });
  if (!r.ok) throw new Error(`innertube ${r.status}`);
  const d = (await r.json()) as {
    continuationContents?: { liveChatContinuation?: {
      continuations?: Record<string, { continuation?: string; timeoutMs?: number }>[];
      actions?: { addChatItemAction?: { item?: Record<string, Renderer> }; replayChatItemAction?: unknown }[];
    } };
  };
  const lc = d.continuationContents?.liveChatContinuation;
  if (!lc) return { messages: [], timeoutMs: 10_000, live: false }; // chat closed / stream ended
  const messages: YtMsg[] = [];
  for (const a of lc.actions ?? []) {
    const item = a.addChatItemAction?.item;
    if (!item) continue;
    const m = toMsg(item);
    if (m) messages.push(m);
  }
  const c = lc.continuations?.[0];
  const cd = c ? (c.invalidationContinuationData ?? c.timedContinuationData ?? c.reloadContinuationData ?? c.liveChatReplayContinuationData) : undefined;
  return {
    messages,
    continuation: cd?.continuation,
    timeoutMs: Math.max(1_000, Math.min(15_000, cd?.timeoutMs ?? 5_000)),
    live: Boolean(cd?.continuation),
  };
}
