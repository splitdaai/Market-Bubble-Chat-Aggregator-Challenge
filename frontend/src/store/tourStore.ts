import { create } from "zustand";

interface TourState {
  active: boolean;
  step: number;
  start: () => void;
  stop: () => void;
  setStep: (n: number) => void;
}

export const useTourStore = create<TourState>((set) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  stop: () => set({ active: false }),
  setStep: (step) => set({ step }),
}));
