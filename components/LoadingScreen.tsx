"use client";

import { useEffect, useRef } from "react";

interface Props {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const DURATION = 1800;
    const start = performance.now();

    // 14 particles spawning from screen edges
    const particles = Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2;
      const dist = Math.min(canvas.width, canvas.height) * 0.52;
      return {
        sx: cx + Math.cos(angle) * dist,
        sy: cy + Math.sin(angle) * dist,
        size: 2.5 + Math.random() * 2,
        delay: i * 60,
        color: i % 3 === 0 ? "#e8826a" : i % 3 === 1 ? "#3b82f6" : "#a855f7",
      };
    });

    function easeInOut(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function drawText(alpha: number, scale: number) {
      if (!ctx) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // "CORTEX" wordmark
      ctx.font = `300 ${48}px Inter, sans-serif`;
      ctx.letterSpacing = "12px";
      ctx.fillStyle = "#e8e8e8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CORTEX", 0, 0);

      // tagline
      ctx.font = `400 ${13}px Inter, sans-serif`;
      ctx.letterSpacing = "3px";
      ctx.fillStyle = "#555";
      ctx.fillText("GLOBAL CONTEXT", 0, 38);

      ctx.restore();
    }

    function frame(now: number) {
      if (!ctx || !canvas) return;
      const elapsed = now - start;
      const t = Math.min(elapsed / DURATION, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles converging
      for (const p of particles) {
        const pt = Math.max(0, (elapsed - p.delay) / (DURATION * 0.6));
        const progress = easeInOut(Math.min(pt, 1));
        const x = lerp(p.sx, cx, progress);
        const y = lerp(p.sy, cy, progress);
        const alpha = pt > 0.8 ? 1 - (pt - 0.8) / 0.2 : pt < 0.1 ? pt * 10 : 1;

        ctx.beginPath();
        ctx.arc(x, y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Bloom glow at center as particles converge
      const bloomT = easeInOut(Math.min((elapsed - 400) / 600, 1));
      if (bloomT > 0) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120 * bloomT);
        grad.addColorStop(0, `rgba(232, 130, 106, ${0.12 * bloomT})`);
        grad.addColorStop(1, "rgba(232, 130, 106, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Wordmark fades in after particles converge
      const textT = Math.max(0, (elapsed - 800) / 500);
      const textAlpha = easeInOut(Math.min(textT, 1));
      const textScale = 0.9 + 0.1 * easeInOut(Math.min(textT, 1));
      if (textAlpha > 0) drawText(textAlpha, textScale);

      // Overall fade out at the end
      if (t > 0.75) {
        const fadeT = (t - 0.75) / 0.25;
        ctx.fillStyle = `rgba(13, 13, 15, ${easeInOut(fadeT)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        onComplete();
      }
    }

    requestAnimationFrame(frame);
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50"
      style={{ background: "#0d0d0f" }}
    />
  );
}
