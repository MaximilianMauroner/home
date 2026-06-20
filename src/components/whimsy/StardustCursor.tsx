import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

/**
 * Lightweight canvas stardust trail that follows the pointer.
 * Disabled for coarse pointers and prefers-reduced-motion.
 */
export default function StardustCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles: Particle[] = [];
    let lastSpawn = 0;

    const spawn = (x: number, y: number) => {
      const now = performance.now();
      if (now - lastSpawn < 16) return;
      lastSpawn = now;
      const count = 2;
      for (let i = 0; i < count; i++) {
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6 - 0.2,
          life: 0,
          maxLife: 600 + Math.random() * 500,
          size: 1 + Math.random() * 2,
          hue: 250 + Math.random() * 40, // indigo → violet
        });
      }
    };

    const onMove = (e: PointerEvent) => spawn(e.clientX, e.clientY);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", resize);

    let raf = 0;
    let prev = performance.now();
    const loop = (now: number) => {
      const dt = now - prev;
      prev = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        const t = 1 - p.life / p.maxLife;
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle = `hsl(${p.hue} 90% 70%)`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `hsl(${p.hue} 90% 70%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
