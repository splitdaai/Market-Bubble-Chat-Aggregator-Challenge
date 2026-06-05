import { useEffect, useRef } from "react";

/**
 * Full-screen GPU-cheap particle canvas. Other components fire bursts via the
 * exported `burst()` singleton — used for hype messages, milestones, etc.
 */

interface P {
  x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number;
}

let emit: ((x: number, y: number, color: string, count?: number) => void) | null = null;

/** Public API: trigger a particle burst at screen coords. */
export function burst(x: number, y: number, color = "#16e6a4", count = 26) {
  emit?.(x, y, color, count);
}

export function ParticleLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const particles: P[] = [];

    const resize = () => {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    emit = (x, y, color, count = 26) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4.5;
        particles.push({
          x, y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 1.5,
          life: 0,
          max: 40 + Math.random() * 30,
          color,
          size: 1.5 + Math.random() * 2.5,
        });
      }
    };

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.98;
        const t = 1 - p.life / p.max;
        if (t <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      emit = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[150]"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
