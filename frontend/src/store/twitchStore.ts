import { create } from "zustand";

/** Which Twitch channel the Stream Preview / Broadcasts / Clips embeds show. */
export const TWITCH_LOGIN = "banks";

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "";

export interface TwitchVod {
  id: string;
  title: string;
  duration: string;
  createdAt: string;
  thumbnail: string;
  url: string;
}
export interface TwitchClip {
  id: string;
  title: string;
  viewCount: number;
  duration: number;
  createdAt: string;
  thumbnail: string;
  creator: string;
}
export type NowPlaying =
  | { kind: "live" }
  | { kind: "vod"; id: string }
  | { kind: "clip"; id: string };

/** Baked-in real data (pulled from Helix) so the embeds always have content,
 *  even if the backend feed is briefly unreachable. Refreshed live on load. */
const FALLBACK_VODS: TwitchVod[] = [
  {
    id: "2779227683",
    title: "Samsung #PlayGalaxy Cup 2026: Latin America — Commentating with @TheNameIsToby",
    duration: "4h36m21s",
    createdAt: "2026-05-23T20:36:22Z",
    thumbnail:
      "https://static-cdn.jtvnw.net/cf_vods/d1m7jfoe9zdc1j/167717153c955e637bb2_banks_318092813684_1779568574//thumb/thumb0-320x180.jpg",
    url: "https://www.twitch.tv/videos/2779227683",
  },
];
const FALLBACK_CLIPS: TwitchClip[] = [
  { id: "SoftGrossButterKeyboardCat-yr-5qB4qz5hN1vhT", title: "ss", viewCount: 15478, duration: 27.8, createdAt: "2022-09-29", creator: "aitoAdinRoss", thumbnail: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/1490db1a-2c61-4288-962d-d9acbfeff157/landscape/thumb/thumb-0000000000-480x272.jpg" },
  { id: "BlazingSpookyLapwingSeemsGood-qmbhGPi_pLz8vDp8", title: "JAILBREAK?????", viewCount: 5681, duration: 30, createdAt: "2025-01-06", creator: "RedNoelOfficial", thumbnail: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/73c59568-14d6-4178-b1b5-78759827f62d/landscape/thumb/thumb-0000000000-480x272.jpg" },
  { id: "AbstrusePopularReubenMau5-Xp-QOswjv3i38XOC", title: "How does m0ndesy do this?", viewCount: 5038, duration: 26.3, createdAt: "2025-01-05", creator: "ch1llouter", thumbnail: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/299d4862-fb1e-4b67-9b43-b83370fa1136/landscape/thumb/thumb-0000000000-480x272.jpg" },
  { id: "BlushingSpookyAnteaterMikeHogu-YyQvwcs8gawU6KOL", title: "Kyousuke on the hype about him.", viewCount: 3323, duration: 60, createdAt: "2025-01-06", creator: "RedNoelOfficial", thumbnail: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/ef598db7-1541-4514-9eab-031c648bb3e1/landscape/thumb/thumb-0000000000-480x272.jpg" },
  { id: "HardPunchyRabbitWoofer-NzI4TJrDYpT8hoAj", title: "i'm such a child xD", viewCount: 2734, duration: 34.9, createdAt: "2024-04-28", creator: "BanKs", thumbnail: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/f08bc98a-3d2e-4b0e-ae55-3d03c0661e02/landscape/thumb/thumb-0000000000-480x272.jpg" },
  { id: "ZealousBlindingPoultryGrammarKing-KN8joSijCbVi0GQ9", title: "kyousuke", viewCount: 2117, duration: 15.9, createdAt: "2025-01-05", creator: "bestofsource", thumbnail: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/cc585e07-69d5-47cd-92e3-6a82fb2709b9/landscape/thumb/thumb-0000000000-480x272.jpg" },
  { id: "SwissFrozenOkapiMcaT-7G9L3OliA_xARkm3", title: "KAKASCHKE MR.BANKS", viewCount: 902, duration: 17, createdAt: "2024-06-29", creator: "lyoha_puzo", thumbnail: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/b6644f1a-0056-4922-8f5c-cbc78e72d47b/landscape/thumb/thumb-0000000000-480x272.jpg" },
  { id: "SpoopySilkyMinkNotLikeThis-LBJYKHhnyjc1FcGX", title: "WW SLONIKI", viewCount: 753, duration: 12.7, createdAt: "2025-01-06", creator: "PvP", thumbnail: "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/30c79415-0ca1-4e69-a320-b98531d24e91/landscape/thumb/thumb-0000000000-480x272.jpg" },
];

interface TwitchState {
  login: string;
  displayName: string;
  live: boolean;
  vods: TwitchVod[];
  clips: TwitchClip[];
  loaded: boolean;
  nowPlaying: NowPlaying | null;
  fetch: () => Promise<void>;
  play: (np: NowPlaying) => void;
}

export const useTwitchStore = create<TwitchState>((set) => ({
  login: TWITCH_LOGIN,
  displayName: "BanKs",
  live: false,
  vods: FALLBACK_VODS,
  clips: FALLBACK_CLIPS,
  loaded: false,
  nowPlaying: null,
  fetch: async () => {
    try {
      const r = await fetch(`${BACKEND}/api/twitch/channel/${TWITCH_LOGIN}`);
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      set({
        login: d.login ?? TWITCH_LOGIN,
        displayName: d.displayName ?? "BanKs",
        live: !!d.live,
        vods: Array.isArray(d.vods) && d.vods.length ? d.vods : FALLBACK_VODS,
        clips: Array.isArray(d.clips) && d.clips.length ? d.clips : FALLBACK_CLIPS,
        loaded: true,
      });
    } catch {
      // keep the baked-in fallback; just mark loaded so the UI shows content
      set({ loaded: true });
    }
  },
  play: (nowPlaying) => set({ nowPlaying }),
}));

/** Build the right Twitch iframe URL for what's playing. `parent` must match the
 *  page host (Twitch embed requirement); we read it live from the browser. */
export function twitchEmbedUrl(np: NowPlaying, login: string): string {
  const parent = typeof location !== "undefined" ? location.hostname : "localhost";
  if (np.kind === "live")
    return `https://player.twitch.tv/?channel=${login}&parent=${parent}&autoplay=true&muted=true`;
  if (np.kind === "vod")
    return `https://player.twitch.tv/?video=${np.id}&parent=${parent}&autoplay=true&muted=true`;
  return `https://clips.twitch.tv/embed?clip=${np.id}&parent=${parent}&autoplay=true`;
}
