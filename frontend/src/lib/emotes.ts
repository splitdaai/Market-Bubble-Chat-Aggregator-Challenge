import { create } from "zustand";

/**
 * Emote engine — 7TV / BTTV / FFZ (global + per-channel) + classic Twitch
 * natives, rendered as inline images in the unified chat.
 *
 * All endpoints are free, no-auth, CORS-open (verified):
 *  - 7TV   global https://7tv.io/v3/emote-sets/global            .emotes[]{name,id} → cdn.7tv.app/emote/<id>/2x.webp
 *  - 7TV   user   https://7tv.io/v3/users/twitch/<id>            .emote_set.emotes[]
 *  - BTTV  global https://api.betterttv.net/3/cached/emotes/global        []{code,id} → cdn.betterttv.net/emote/<id>/2x.webp
 *  - BTTV  user   https://api.betterttv.net/3/cached/users/twitch/<id>    .channelEmotes + .sharedEmotes
 *  - FFZ   global https://api.frankerfacez.com/v1/set/global     .sets[id].emoticons[]{name,urls}
 *  - FFZ   room   https://api.frankerfacez.com/v1/room/<login>
 *  - Twitch login → id: https://api.ivr.fi/v2/twitch/user?login=<login> (no auth, CORS *)
 */

const map = new Map<string, string>();
let started = false;
const loadedChannels = new Set<string>();

/** Bumped when emote sets land so chat re-renders with images. */
export const useEmoteStore = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export function getEmoteUrl(word: string): string | undefined {
  return map.get(word);
}

// Classic Twitch global emotes (ids are stable; no list API needed).
const TWITCH_NATIVE: Record<string, string> = {
  Kappa: "25", PogChamp: "305954156", LUL: "425618", BibleThump: "86", DansGame: "33",
  "4Head": "354", EleGiggle: "4339", Kreygasm: "41", NotLikeThis: "58765", ResidentSleeper: "245",
  SeemsGood: "64138", WutFace: "28087", Jebaited: "114836", HeyGuys: "30259", PJSalt: "36",
  SwiftRage: "34", FailFish: "360", VoHiYo: "81274", TwitchUnity: "196892", CurseLit: "116625",
};

const j = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

function addSevenTv(emotes: Array<{ name: string; id: string }> | undefined) {
  for (const e of emotes ?? []) if (e?.name && e?.id) map.set(e.name, `https://cdn.7tv.app/emote/${e.id}/2x.webp`);
}
function addBttv(emotes: Array<{ code: string; id: string }> | undefined) {
  for (const e of emotes ?? []) if (e?.code && e?.id) map.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x.webp`);
}
function addFfz(sets: Record<string, { emoticons?: Array<{ name: string; hidden?: boolean; urls?: Record<string, string> }> }> | undefined) {
  for (const set of Object.values(sets ?? {})) {
    for (const e of set.emoticons ?? []) {
      if (e?.hidden) continue;
      const url = e.urls?.["2"] ?? e.urls?.["1"];
      if (e?.name && url) map.set(e.name, url.startsWith("http") ? url : `https:${url}`);
    }
  }
}

/** Load the global sets (once) + per-channel sets for the given Twitch logins. */
export function initEmotes(twitchLogins: string[] = []): void {
  const bump = () => useEmoteStore.getState().bump();

  if (!started) {
    started = true;
    for (const [name, id] of Object.entries(TWITCH_NATIVE)) {
      map.set(name, `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`);
    }
    void j("https://7tv.io/v3/emote-sets/global").then((d) => { addSevenTv(d?.emotes); bump(); }).catch(() => {});
    void j("https://api.betterttv.net/3/cached/emotes/global").then((d) => { addBttv(d); bump(); }).catch(() => {});
    void j("https://api.frankerfacez.com/v1/set/global").then((d) => { addFfz(d?.sets); bump(); }).catch(() => {});
    bump();
  }

  for (const raw of twitchLogins) {
    const login = raw.replace(/^[@#]/, "").toLowerCase();
    if (!login || loadedChannels.has(login)) continue;
    loadedChannels.add(login);
    // FFZ rooms key by login directly; 7TV/BTTV need the Twitch user id.
    void j(`https://api.frankerfacez.com/v1/room/${login}`).then((d) => { addFfz(d?.sets); bump(); }).catch(() => {});
    void j(`https://api.ivr.fi/v2/twitch/user?login=${login}`)
      .then((users) => {
        const id = users?.[0]?.id;
        if (!id) return;
        void j(`https://7tv.io/v3/users/twitch/${id}`).then((d) => { addSevenTv(d?.emote_set?.emotes); bump(); }).catch(() => {});
        void j(`https://api.betterttv.net/3/cached/users/twitch/${id}`).then((d) => { addBttv([...(d?.channelEmotes ?? []), ...(d?.sharedEmotes ?? [])]); bump(); }).catch(() => {});
      })
      .catch(() => {});
  }
}
