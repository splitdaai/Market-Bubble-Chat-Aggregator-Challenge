import { MSection, MCard } from "./ui";

/** Mobile Content — recent broadcasts / replays as clean playable cards. */
export function MobileContent() {
  return (
    <div className="pb-6">
      <MSection title="Recent Broadcasts">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <MCard key={n} className="overflow-hidden">
              <video
                src={`/vods/vod-${n}.mp4#t=0.1`}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-black object-cover"
              />
              <div className="px-3 py-2">
                <div className="text-[13px] font-bold">Market Bubble — Episode {n}</div>
                <div className="text-[11px] text-muted">Replay · on-demand</div>
              </div>
            </MCard>
          ))}
        </div>
      </MSection>
    </div>
  );
}
