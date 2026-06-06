import type { ChatMessage, Platform, Badge, ChatEvent } from "@shared/types";
import { useGiveawayStore } from "@/store/giveawayStore";
import { useConnectionsStore, connectedAccounts } from "@/store/connectionsStore";
import { useModeStore } from "@/store/modeStore";
import { DEMO_ACCOUNTS } from "@/lib/accounts";

/**
 * Mock message firehose. Lets the whole UI feel alive with zero backend.
 * Generates messages across every connected account (multi-account, multi-
 * platform), tagged with their source channel. The real socket layer swaps
 * this out transparently (see socket.ts).
 */

const USERS: Record<Platform, { name: string; color: string }[]> = {
  twitch: [
    { name: "ninjacat_42", color: "#9146ff" },
    { name: "PogChampion", color: "#ff7edb" },
    { name: "xX_dogelord_Xx", color: "#c9a3ff" },
    { name: "streamSniperz", color: "#7d5fff" },
  ],
  kick: [
    { name: "greenScreenGuy", color: "#53fc18" },
    { name: "kickflipKing", color: "#9dff5a" },
    { name: "toxicAvenger", color: "#b6ff00" },
  ],
  x: [
    { name: "@cryptochad", color: "#e7e9ea" },
    { name: "@vibesonly", color: "#b8c0c8" },
    { name: "@degenharry", color: "#ffffff" },
  ],
  youtube: [
    { name: "@MacroMike", color: "#ff6d6d" },
    { name: "@ChartWizard", color: "#ff9aa2" },
    { name: "@OptionsOracle", color: "#ffd0d0" },
    { name: "@BullRunBecky", color: "#ff4d4d" },
  ],
};

const LINES = [
  "yo this stream is actually insane 🔥",
  "first time catching you live, instant follow",
  "W content as always",
  "how is the aggregator handling all 3 chats at once??",
  "neon theme goes so hard",
  "GG that was clean",
  "wen $10k prize 👀",
  "the drag and drop editor is buttery",
  "LOL",
  "LMAOOO 😂",
  "I'm crying 😭😂",
  "bro 💀💀",
  "nah this is too funny 😂😂",
  "lmaooo not him doing that",
  "someone clip that",
  "to the moon 🚀🚀",
  "mods are asleep post vibes",
  "this UI looks expensive lol",
  "kick chat in the SAME feed?? wild",
  "real time and zero lag, respect",
];

const HYPE = [
  "RAID INCOMING 🚀🚀🚀",
  "just dropped a 100 bit cheer!!!",
  "Tier 3 sub gang 💜",
  "HYPE TRAIN LETS GOOO",
  "donated $50 keep cooking 🔥",
];

const BADGES: Record<Platform, Badge[][]> = {
  twitch: [
    [{ type: "subscriber", label: "Sub" }],
    [{ type: "moderator", label: "Mod" }],
    [{ type: "vip", label: "VIP" }],
    [],
  ],
  kick: [[{ type: "og", label: "OG" }], [{ type: "subscriber", label: "Sub" }], []],
  x: [[{ type: "verified", label: "Verified" }], []],
  youtube: [[{ type: "subscriber", label: "Member" }], [{ type: "moderator", label: "Mod" }], []],
};

let seq = 0;
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** A larger roster so giveaway entrant counts look believable. */
function randomUser(platform: Platform) {
  const base = USERS[platform];
  const u = pick(base);
  // Occasionally append a number to mint a "new" viewer name.
  return Math.random() < 0.5
    ? u
    : { name: `${u.name}${Math.floor(Math.random() * 90) + 10}`, color: u.color };
}

/** A hype moment — often carries a monetization event (tip/bits/sub/gift). */
function makeHype(): { text: string; event?: ChatEvent } {
  const roll = Math.random();
  if (roll < 0.3) {
    const bits = pick([50, 100, 200, 300, 500, 1000]);
    return { text: `dropped a ${bits} bit cheer!!! 🔥`, event: { kind: "bits", amount: bits / 100, label: `${bits} bits` } };
  }
  if (roll < 0.58) {
    const amt = pick([5, 10, 20, 25, 50, 100]);
    return { text: `donated $${amt} keep cooking 🔥`, event: { kind: "donation", amount: amt, label: `$${amt}` } };
  }
  if (roll < 0.78) {
    const tier = pick([1, 2, 3]);
    const amt = tier === 1 ? 5 : tier === 2 ? 10 : 25;
    return { text: `Tier ${tier} sub gang 💜`, event: { kind: "subscription", amount: amt, count: 1, label: `Tier ${tier}` } };
  }
  if (roll < 0.92) {
    const n = pick([1, 3, 5, 10, 25]);
    return { text: `gifted ${n} subs 🎁`, event: { kind: "gift", amount: n * 5, count: n, label: `${n}× gifted` } };
  }
  return { text: pick(["RAID INCOMING 🚀🚀🚀", "HYPE TRAIN LETS GOOO"]) };
}

/** Generate a single believable message from one of the connected accounts. */
export function makeMockMessage(forced?: Platform): ChatMessage {
  // Demo chat always reflects the canonical demo channels (Ansem / Banks /
  // Market Bubble), independent of any real accounts. In Live mode the backend
  // replaces the connections store with the user's own channels (e.g. splitdawig)
  // and persists it — so without this, switching back to Demo would attribute
  // mock chat to the live channels instead of the demo trio.
  const source = useModeStore.getState().demo ? DEMO_ACCOUNTS : useConnectionsStore.getState().accounts;
  const accounts = connectedAccounts(source);
  const pool = forced ? accounts.filter((a) => a.platform === forced) : accounts;
  const account = pool.length ? pick(pool) : null;
  const platform: Platform = account?.platform ?? forced ?? pick(["twitch", "kick", "x", "youtube"] as Platform[]);

  const user = randomUser(platform);
  const isHype = Math.random() < 0.14;
  const hype = isHype ? makeHype() : null;
  seq += 1;
  return {
    id: `${platform}:mock-${seq}-${Math.floor(Math.random() * 1e6)}`,
    nativeId: `mock-${seq}`,
    platform,
    accountId: account?.id,
    channel: account?.displayName,
    username: user.name,
    color: user.color,
    message: hype ? hype.text : pick(LINES),
    timestamp: Date.now(),
    badges: pick(BADGES[platform]),
    hype: isHype,
    event: hype?.event,
  };
}

/** A viewer typing the giveaway keyword to enter. */
function makeEntryMessage(keyword: string): ChatMessage {
  const m = makeMockMessage();
  const flavor = pick(["", " me!", " 🤞", " lets go", " pick me", " 🎁"]);
  return { ...m, message: `${keyword}${flavor}`, hype: false };
}

/**
 * Start a randomized firehose. Returns a stop() function.
 *
 * Interval jitters so it feels like real human chat, not a metronome. Every so
 * often it enters a short "burst" — chat popping off on a big play — which
 * produces a real velocity spike so the Clip Radar + Hype meter actually fire.
 */
export function startMockStream(onMessage: (m: ChatMessage) => void): () => void {
  let alive = true;
  let burstLeft = 0; // remaining messages in the current burst

  const tick = () => {
    if (!alive) return;

    // When a giveaway is live, a chunk of chat is people entering.
    const gw = useGiveawayStore.getState();
    if (gw.phase === "running" && Math.random() < 0.55) {
      onMessage(makeEntryMessage(gw.config.keyword));
    } else {
      onMessage(makeMockMessage());
    }

    let next: number;
    if (burstLeft > 0) {
      burstLeft -= 1;
      next = 60 + Math.random() * 90; // rapid-fire during a burst
    } else {
      // ~1-in-90 normal ticks kicks off a hype burst of 18–30 messages.
      if (Math.random() < 0.011) burstLeft = 18 + Math.floor(Math.random() * 12);
      next = 350 + Math.random() * 1100;
    }
    window.setTimeout(tick, next);
  };

  window.setTimeout(tick, 400);
  return () => {
    alive = false;
  };
}
