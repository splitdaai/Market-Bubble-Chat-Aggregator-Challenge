import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  tone: "ok" | "error" | "info";
  /** Optional undo handler — renders an Undo button. */
  onUndo?: () => void;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

let n = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    n += 1;
    const id = `t-${n}-${Date.now()}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
