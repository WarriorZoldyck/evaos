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
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const imageLoadedRef = useRef(false);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [proximity, setProximity] = useState(0);

  const sampleImageToParticles = useCallback((canvasW: number, canvasH: number) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const offCanvas = document.createElement("canvas");
      // Use full canvas dimensions (3:4 aspect) instead of forcing square
      const drawW = canvasW;
      const drawH = canvasH;
      offCanvas.width = drawW;
      offCanvas.height = drawH;
      const offCtx = offCanvas.getContext("2d");
      if (!offCtx) return;

      // Cover-fit the image into the canvas area
      const imgAspect = img.width / img.height;
      const canvasAspect = drawW / drawH;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > canvasAspect) {
        sw = img.height * canvasAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasAspect;
        sy = (img.height - sh) / 2;
      }

      offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, drawW, drawH);
      const imageData = offCtx.getImageData(0, 0, drawW, drawH);
      const pixels = imageData.data;

      const particles: Particle[] = [];
      const step = Math.max(5, Math.floor(Math.min(drawW, drawH) / 80));

      for (let y = 0; y < drawH; y += step) {
        for (let x = 0; x < drawW; x += step) {
          const i = (y * drawW + x) * 4;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          if (a < 100 || brightness < 0.08) continue;

          // Vertical fade: particles near bottom fade out for holographic effect
          const verticalFade = 1 - Math.max(0, (y / drawH - 0.7)) * 2.5;

          particles.push({
            x: x,
            y: y,
            originX: x,
            originY: y,
            size: 0.8 + brightness * 1.5,
            opacity: (0.3 + brightness * 0.6) * Math.max(0.05, verticalFade),
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
      const nx = e.clientX / window.innerWidth;
      const ny = e.clientY / window.innerHeight;
      mouseRef.current = { x: nx, y: ny };
      setTilt({
        rotateY: (nx - 0.5) * 12,
        rotateX: (0.5 - ny) * 12,
      });

      // Calculate proximity to avatar center (0 = far, 1 = on top)
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2);
        const maxDist = rect.width * 1.2;
        setProximity(Math.max(0, 1 - dist / maxDist));
      }
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

  const glowOpacity = 0.04 + proximity * 0.12;
  const glowScale = 1 + proximity * 0.06;
  const outerGlowOpacity = proximity * 0.08;

  return (
    <div ref={containerRef} className="relative w-full aspect-square max-w-[480px] mx-auto" style={{ perspective: "800px" }}>
      <div
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.15s ease-out",
        }}
        className="relative w-full h-full"
      >
        {/* Inner radial glow */}
        <div
          className="absolute inset-[-10%] rounded-full"
          style={{
            background: `radial-gradient(circle, hsla(195,100%,50%,${glowOpacity}) 0%, transparent 70%)`,
            transform: `scale(${glowScale})`,
            transition: "background 0.3s ease-out, transform 0.3s ease-out",
          }}
        />
        {/* Outer ring glow */}
        <div
          className="absolute inset-[-18%] rounded-full"
          style={{
            background: `radial-gradient(circle, transparent 40%, hsla(195,100%,55%,${outerGlowOpacity}) 60%, transparent 75%)`,
            transition: "background 0.3s ease-out",
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
    </div>
  );
}