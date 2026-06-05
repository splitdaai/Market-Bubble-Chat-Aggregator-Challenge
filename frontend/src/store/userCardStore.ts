import { create } from "zustand";
import type { Platform } from "@shared/types";

/** Which viewer's profile card is open (Twitch-style click-a-name popout). */
interface UserCardState {
  open: { name: string; platform: Platform } | null;
  show: (name: string, platform: Platform) => void;
  close: () => void;
}

export const useUserCardStore = create<UserCardState>((set) => ({
  open: null,
  show: (name, platform) => set({ open: { name, platform } }),
  close: () => set({ open: null }),
}));
