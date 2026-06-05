import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertTriangle, Info, Undo2 } from "lucide-react";
import { useToastStore } from "@/store/toastStore";

const ICON = {
  ok: <Check size={15} className="text-emerald-400" />,
  error: <AlertTriangle size={15} className="text-red-400" />,
  info: <Info size={15} className="text-accent" />,
};

/** Bottom-right toast stack with optional Undo (moderation confirmations). */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-5 right-5 z-[300] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="vc-glass flex items-center gap-2.5 px-3 py-2.5 text-sm"
          >
            {ICON[t.tone]}
            <span className="flex-1 font-medium text-ink">{t.message}</span>
            {t.onUndo && (
              <button
                onClick={() => { t.onUndo!(); dismiss(t.id); }}
                className="flex items-center gap-1 rounded-md border border-accent/40 px-2 py-1 text-xs font-bold text-accent hover:bg-accent/10"
              >
                <Undo2 size={12} /> Undo
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
