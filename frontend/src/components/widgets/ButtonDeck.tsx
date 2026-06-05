import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { Plus, Pencil } from "lucide-react";
import { useLayoutStore } from "@/store/layoutStore";
import { useToastStore } from "@/store/toastStore";
import { burst } from "../Particles";
import { getSocket } from "@/lib/socket";
import type { ActionButton } from "@shared/types";

/** Resolve a Lucide icon by name; fall back to a zap glyph. */
function Icon({ name, size = 16 }: { name?: string; size?: number }) {
  const Cmp = (name && (Icons as Record<string, unknown>)[name]) as
    | React.ComponentType<{ size?: number }>
    | undefined;
  const Fallback = Icons.Zap;
  const C = Cmp ?? Fallback;
  return <C size={size} />;
}

/**
 * Custom action buttons (Raid, Hype Train, meme reactions...). Styled per-button,
 * each fires its command at the assigned platforms. In edit mode you can add /
 * edit them via the Button Editor.
 */
export function ButtonDeck({ onEdit }: { onEdit?: (b?: ActionButton) => void }) {
  const buttons = useLayoutStore((s) => s.buttons);
  const editMode = useLayoutStore((s) => s.editMode);
  const push = useToastStore((s) => s.push);

  const fire = (b: ActionButton, e: React.MouseEvent) => {
    burst(e.clientX, e.clientY, b.color, 22);
    // Send the command to the backend in live mode (no-op socket in demo).
    getSocket()?.emit("command:run", b);
    push({ message: `▶ ${b.command} → ${b.platforms.join(", ")}`, tone: "info" });
  };

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Action Deck</span>
        {editMode && (
          <button
            onClick={() => onEdit?.()}
            className="flex items-center gap-1 rounded-md border border-accent/40 px-1.5 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/10"
          >
            <Plus size={11} /> New
          </button>
        )}
      </div>

      <div className="vc-scroll grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
        {buttons.map((b) => (
          <motion.button
            key={b.id}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => fire(b, e)}
            className="group relative flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center"
            style={{
              borderColor: `color-mix(in srgb, ${b.color} 45%, transparent)`,
              background: `color-mix(in srgb, ${b.color} 10%, transparent)`,
              color: b.color,
              boxShadow: `0 0 14px color-mix(in srgb, ${b.color} 22%, transparent)`,
            }}
          >
            <Icon name={b.icon} />
            <span className="text-[11px] font-bold text-ink">{b.label}</span>
            {editMode && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onEdit?.(b); }}
                className="absolute right-1 top-1 hidden rounded bg-black/50 p-0.5 group-hover:block"
              >
                <Pencil size={10} />
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
