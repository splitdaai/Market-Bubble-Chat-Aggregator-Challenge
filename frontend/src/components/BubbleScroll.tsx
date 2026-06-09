import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A scroll container with a sleek custom "bubble" scrollbar that fades in while
 * scrolling/hovering and disappears when idle. Drag the bubble to scrub.
 */
export function BubbleScroll({ children, className = "", maxHeight }: { children: React.ReactNode; className?: string; maxHeight?: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, show: false });

  const recompute = useCallback((keepVisible = true) => {
    const el = scroller.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 4) { setThumb((t) => ({ ...t, show: false })); return; }
    const height = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
    setThumb({ top, height, show: keepVisible });
    if (keepVisible) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setThumb((t) => ({ ...t, show: false })), 1400);
    }
  }, []);

  useEffect(() => {
    recompute(false);
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recompute(false));
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  const onThumbDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = scroller.current;
    if (!el) return;
    const startY = e.clientY;
    const startTop = el.scrollTop;
    const ratio = el.scrollHeight / el.clientHeight;
    const move = (ev: MouseEvent) => { el.scrollTop = startTop + (ev.clientY - startY) * ratio; };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  return (
    <div className={`relative min-h-0 ${className}`} onMouseEnter={() => recompute()} onMouseLeave={() => setThumb((t) => ({ ...t, show: false }))}>
      <div ref={scroller} onScroll={() => recompute()} style={maxHeight ? { maxHeight } : undefined} className={`bubble-scroll-area overflow-y-auto pr-2 ${maxHeight ? "" : "h-full"}`}>
        {children}
      </div>
      <div
        onMouseDown={onThumbDown}
        className="absolute right-0.5 w-1.5 cursor-grab rounded-full bg-accent/70 shadow-[0_0_8px_rgba(0,216,114,0.5)] transition-opacity duration-300 hover:bg-accent active:cursor-grabbing"
        style={{ top: thumb.top, height: thumb.height, opacity: thumb.show ? 1 : 0, pointerEvents: thumb.show ? "auto" : "none" }}
      />
    </div>
  );
}
