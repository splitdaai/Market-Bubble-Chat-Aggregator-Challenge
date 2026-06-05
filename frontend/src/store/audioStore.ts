import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Audio for the stream-preview clip. Starts muted so autoplay is allowed; the
 * topbar speaker control unmutes + sets the volume, which the <video> reads.
 */
interface AudioState {
  muted: boolean;
  volume: number; // 0..1
  setVolume: (v: number) => void;
  toggleMuted: () => void;
  setMuted: (v: boolean) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      muted: true,
      volume: 0.7,
      setVolume: (volume) =>
        set({ volume, muted: volume === 0 }), // dragging to 0 mutes; above 0 unmutes
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setMuted: (muted) => set({ muted }),
    }),
    { name: "vibechat-audio" },
  ),
);
