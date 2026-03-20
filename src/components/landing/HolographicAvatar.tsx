import { useRef, useEffect, useCallback, useState } from "react";
import evaAvatar from "@/assets/eva-avatar.png";

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  size: number;
  opacity: number;
  hue: number;
  lightness: number;
}

export function HolographicAvatar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const imageLoadedRef = useRef(false);
  const mouseRef = useRef({ x: 0.5, y: 0.5 }); // normalized 0-1

  const sampleImageToParticles = useCallback((canvasW: number, canvasH: number) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const offCanvas = document.createElement("canvas");
      const size = Math.min(canvasW, canvasH);
      offCanvas.width = size;
      offCanvas.height = size;
      const offCtx = offCanvas.getContext("2d");
      if (!offCtx) return;

      const imgAspect = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > 1) { sx = (img.width - img.height) / 2; sw = img.height; }
      else { sy = (img.height - img.width) / 2; sh = img.width; }

      offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
      const imageData = offCtx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      const particles: Particle[] = [];
      const step = Math.max(5, Math.floor(size / 80));
      const offsetX = (canvasW - size) / 2;
      const offsetY = (canvasH - size) / 2;

      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const i = (y * size + x) * 4;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          if (a < 100 || brightness < 0.08) continue;

          particles.push({
            x: x + offsetX,
            y: y + offsetY,
            originX: x + offsetX,
            originY: y + offsetY,
            size: 0.8 + brightness * 1.5,
            opacity: 0.3 + brightness * 0.6,
            hue: 190 + (brightness - 0.5) * 15,
            lightness: 45 + brightness * 30,
          });
        }
      }

      particlesRef.current = particles;
      imageLoadedRef.current = true;
    };
    img.src = evaAvatar;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      sampleImageToParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", handleMouseMove);

    let t = 0;
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      t += 0.012;

      ctx.clearRect(0, 0, w, h);

      if (!imageLoadedRef.current) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const particles = particlesRef.current;
      const mx = (mouseRef.current.x - 0.5) * 18; // max ~9px shift
      const my = (mouseRef.current.y - 0.5) * 18;

      for (const p of particles) {
        const flicker = 0.85 + 0.15 * Math.sin(t * 0.8 + p.originX * 0.05 + p.originY * 0.03);
        const alpha = p.opacity * flicker;

        const px = p.originX + mx;
        const py = p.originY + my;

        ctx.fillStyle = `hsla(${p.hue}, 90%, ${p.lightness}%, ${alpha})`;
        ctx.fillRect(px - p.size * 0.5, py - p.size * 0.5, p.size, p.size);
      }

      // Single scan line
      const scanY = (t * 25) % h;
      ctx.fillStyle = "hsla(195, 100%, 70%, 0.03)";
      ctx.fillRect(0, scanY, w, 1);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [sampleImageToParticles]);

  return (
    <div className="relative w-full aspect-square max-w-[480px] mx-auto">
      <div
        className="absolute inset-[-10%] rounded-full opacity-60"
        style={{
          background: "radial-gradient(circle, hsla(195,100%,50%,0.08) 0%, transparent 70%)",
        }}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full relative z-10"
      />
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-[hsl(195,100%,50%/0.6)] font-medium">EVA · Assistente IA</p>
      </div>
    </div>
  );
}