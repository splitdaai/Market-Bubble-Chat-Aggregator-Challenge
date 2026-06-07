import { Play, Radio, Clock } from "lucide-react";
import { useBroadcastStore, BROADCASTS } from "@/store/broadcastStore";
import { usePreviewStore } from "@/store/previewStore";
import { useToastStore } from "@/store/toastStore";
import { useBroadcastThumbs } from "@/hooks/useBroadcastThumbs";

/** Past broadcasts (VODs) + the live stream — click one to play it in the preview. */
export function Broadcasts() {
  const currentId = useBroadcastStore((s) => s.currentId);
  const select = useBroadcastStore((s) => s.select);
  const previewHidden = usePreviewStore((s) => s.hidden);
  const showPreview = usePreviewStore((s) => s.toggle);
  const push = useToastStore((s) => s.push);
  const thumbs = useBroadcastThumbs();

  const play = (id: string, title: string) => {
    select(id);
    if (previewHidden) showPreview(); // make sure the preview is visible
    push({ message: `Now playing · ${title}`, tone: "ok" });
  };

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Radio size={14} className="text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Broadcasts</span>
        <span className="ml-auto text-[10px] text-muted">{BROADCASTS.length - 1} past · 1 live</span>
      </div>

      <div className="vc-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {BROADCASTS.map((b) => {
          const active = b.id === currentId;
          return (
            <button
              key={b.id}
              onClick={() => play(b.id, b.title)}
              className={`group flex items-center gap-3 rounded-lg border p-2 text-left transition ${
                active ? "border-accent/60 bg-accent/[0.08]" : "border-white/8 bg-white/[0.02] hover:border-accent/40 hover:bg-accent/[0.05]"
              }`}
            >
              {/* thumb — a real frame captured from the broadcast */}
              <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
                {thumbs[b.id] ? (
                  <img src={thumbs[b.id]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center"><img src="/logo-white.png" alt="" className="h-5 w-5 opacity-20" /></div>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                  <Play size={16} className="text-white drop-shadow" />
                </span>
                {b.live ? (
                  <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-red-500 px-1 text-[7px] font-black uppercase text-white">live</span>
                ) : (
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[7px] font-bold tabular-nums text-white">{b.duration}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-ink">{b.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
                  <span>{b.date}</span>
                  <span className="flex items-center gap-0.5"><Clock size={9} /> {b.duration}</span>
                </div>
              </div>
              {active && <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-accent">Playing</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
