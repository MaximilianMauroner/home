import { useEffect, useRef, useState } from "react";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

/**
 * Konami code easter egg: hyperspace star-warp + a free-floating astronaut.
 * Auto-dismisses after a few seconds or on the next key press.
 */
export default function KonamiCode() {
  const [active, setActive] = useState(false);
  const progress = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (active) {
        setActive(false);
        return;
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const expected = SEQUENCE[progress.current];
      if (key === expected) {
        progress.current += 1;
        if (progress.current === SEQUENCE.length) {
          progress.current = 0;
          setActive(true);
        }
      } else {
        progress.current = key === SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const timeout = setTimeout(() => setActive(false), 7000);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    let raf = 0;
    if (canvas && ctx) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = cw / 2;
      const cy = ch / 2;
      const stars = Array.from({ length: 320 }, () => ({
        a: Math.random() * Math.PI * 2,
        r: Math.random() * Math.max(cw, ch),
        z: Math.random() * 0.5 + 0.5,
      }));
      const loop = () => {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(0, 0, cw, ch);
        for (const s of stars) {
          const px = cx + Math.cos(s.a) * s.r;
          const py = cy + Math.sin(s.a) * s.r;
          s.r += s.z * 14;
          const nx = cx + Math.cos(s.a) * s.r;
          const ny = cy + Math.sin(s.a) * s.r;
          ctx.strokeStyle = `hsl(${250 + s.z * 40} 90% ${60 + s.z * 20}%)`;
          ctx.lineWidth = s.z * 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
          ctx.stroke();
          if (s.r > Math.max(cw, ch)) {
            s.a = Math.random() * Math.PI * 2;
            s.r = Math.random() * 40;
          }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden bg-black"
      role="presentation"
      onClick={() => setActive(false)}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <img
        src="/astronaut.avif"
        alt=""
        aria-hidden="true"
        className="konami-astronaut absolute h-32 w-32 drop-shadow-[0_0_25px_rgba(129,140,248,0.6)]"
      />
      <p className="absolute bottom-10 left-1/2 -translate-x-1/2 font-mono text-sm text-indigo-300/80">
        warp speed engaged — press any key to return
      </p>
      <style>{`
        @keyframes konami-drift {
          0%   { transform: translate(-20vw, 70vh) rotate(0deg); }
          50%  { transform: translate(60vw, 20vh) rotate(180deg); }
          100% { transform: translate(110vw, 60vh) rotate(360deg); }
        }
        .konami-astronaut {
          top: 0; left: 0;
          animation: konami-drift 7s linear forwards;
        }
      `}</style>
    </div>
  );
}
