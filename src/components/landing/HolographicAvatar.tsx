import { useRef, useEffect, useCallback } from "react";
import evaAvatar from "@/assets/eva-avatar.png";

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
  speed: number;
  hue: number;
  lightness: number;
}

function makeParticle(x: number, y: number, hue = 195, lightness = 65): Particle {
  return {
    x, y,
    originX: x,
    originY: y,
    vx: 0, vy: 0,
    size: 1.2 + Math.random() * 1.2,
    opacity: 0.5 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 1.5,
    hue,
    lightness,
  };
}

export function HolographicAvatar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const imageLoadedRef = useRef(false);

  const sampleImageToParticles = useCallback((canvasW: number, canvasH: number) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Draw image to offscreen canvas to sample pixels
      const offCanvas = document.createElement("canvas");
      const size = Math.min(canvasW, canvasH);
      offCanvas.width = size;
      offCanvas.height = size;
      const offCtx = offCanvas.getContext("2d");
      if (!offCtx) return;

      // Center crop the image
      const imgAspect = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > 1) {
        sx = (img.width - img.height) / 2;
        sw = img.height;
      } else {
        sy = (img.height - img.width) / 2;
        sh = img.width;
      }

      offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
      const imageData = offCtx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      const particles: Particle[] = [];
      const step = Math.max(3, Math.floor(size / 120)); // ~120x120 grid → ~1400 particles max
      const offsetX = (canvasW - size) / 2;
      const offsetY = (canvasH - size) / 2;

      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const i = (y * size + x) * 4;
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          // Calculate brightness
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          
          // Skip very dark or transparent pixels (background)
          if (a < 100 || brightness < 0.08) continue;

          // Map colors to holographic cyan/blue palette
          // Brighter areas → brighter cyan particles, darker → deeper blue
          const hue = 190 + (brightness - 0.5) * 20; // 180-210 range
          const lightness = 40 + brightness * 35; // 40-75 range

          const px = x + offsetX;
          const py = y + offsetY;
          
          // Add some density variation — brighter areas get more particles
          const p = makeParticle(px, py, hue, lightness);
          p.size = 0.8 + brightness * 1.8;
          p.opacity = 0.3 + brightness * 0.7;
          particles.push(p);

          // Extra particles for bright areas (face features)
          if (brightness > 0.5 && Math.random() < 0.3) {
            const extra = makeParticle(
              px + (Math.random() - 0.5) * step * 0.5,
              py + (Math.random() - 0.5) * step * 0.5,
              hue,
              lightness + 10
            );
            extra.size = 0.6 + Math.random() * 0.8;
            particles.push(extra);
          }
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
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      sampleImageToParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      mouseRef.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };
    const handleLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("mouseleave", handleLeave);
    canvas.addEventListener("touchend", handleLeave);

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.clearRect(0, 0, w, h);

      // Background radial glow
      const grad = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, w * 0.45);
      grad.addColorStop(0, "hsla(195, 100%, 50%, 0.06)");
      grad.addColorStop(0.6, "hsla(195, 100%, 50%, 0.02)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      if (!imageLoadedRef.current) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const particles = particlesRef.current;
      const mouseRadius = 60;

      // Update particles
      for (const p of particles) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouseRadius && dist > 0) {
          const force = (mouseRadius - dist) / mouseRadius;
          p.vx += (dx / dist) * force * 4;
          p.vy += (dy / dist) * force * 4;
        }

        // Spring back
        const sx = p.originX - p.x;
        const sy = p.originY - p.y;
        p.vx += sx * 0.04;
        p.vy += sy * 0.04;

        // Damping
        p.vx *= 0.9;
        p.vy *= 0.9;

        // Subtle breathing
        p.x += p.vx + Math.sin(t * 0.4 + p.phase) * 0.2;
        p.y += p.vy + Math.sin(t * p.speed * 0.3 + p.phase) * 0.15;

        // Dynamic opacity
        const distFromOrigin = Math.sqrt(sx * sx + sy * sy);
        const baseOpacity = p.opacity * (0.7 + 0.3 * Math.sin(t * p.speed * 0.5 + p.phase));
        p.opacity = Math.max(0.1, baseOpacity * Math.max(0.3, 1 - distFromOrigin / 80));
      }

      // Draw connection lines (only nearby particles)
      ctx.lineWidth = 0.3;
      const connectionDist = 400; // squared distance = 20px
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        // Only check nearby particles for performance
        for (let j = i + 1; j < Math.min(i + 30, particles.length); j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = dx * dx + dy * dy;
          if (d < connectionDist) {
            const alpha = (1 - d / connectionDist) * 0.1;
            ctx.strokeStyle = `hsla(195, 100%, 60%, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        // Main dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${p.lightness}%, ${p.opacity})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${p.lightness}%, ${p.opacity * 0.12})`;
        ctx.fill();
      }

      // Scan line
      const scanY = (t * 30) % h;
      ctx.fillStyle = "hsla(195, 100%, 70%, 0.03)";
      ctx.fillRect(0, scanY, w, 2);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("mouseleave", handleLeave);
      canvas.removeEventListener("touchend", handleLeave);
    };
  }, [sampleImageToParticles]);

  return (
    <div className="relative w-full aspect-square max-w-[480px] mx-auto">
      {/* Outer glow */}
      <div
        className="absolute inset-[-20%] rounded-full"
        style={{
          background: "radial-gradient(circle, hsla(195,100%,50%,0.12) 0%, hsla(195,100%,50%,0.04) 40%, transparent 70%)",
          filter: "blur(30px)",
          animation: "pulse 4s ease-in-out infinite",
        }}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full relative z-10 cursor-crosshair"
        style={{ touchAction: "none" }}
      />
      {/* Label */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-[hsl(195,100%,50%/0.6)] font-medium">EVA · Assistente IA</p>
      </div>
    </div>
  );
}
