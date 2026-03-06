import { useRef, useEffect, useCallback } from "react";

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
}

export function HolographicAvatar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  const createParticles = useCallback((w: number, h: number) => {
    const particles: Particle[] = [];
    const cx = w / 2;

    // Head (ellipse)
    const headCx = cx;
    const headCy = h * 0.22;
    const headRx = w * 0.14;
    const headRy = w * 0.17;
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      particles.push(makeParticle(
        headCx + Math.cos(angle) * headRx * r,
        headCy + Math.sin(angle) * headRy * r
      ));
    }

    // Neck
    for (let i = 0; i < 40; i++) {
      particles.push(makeParticle(
        cx + (Math.random() - 0.5) * w * 0.06,
        h * 0.36 + Math.random() * h * 0.06
      ));
    }

    // Shoulders + upper torso (trapezoid)
    for (let i = 0; i < 300; i++) {
      const t = Math.random();
      const y = h * 0.42 + t * h * 0.35;
      const widthAtY = w * 0.12 + t * w * 0.28;
      const x = cx + (Math.random() - 0.5) * widthAtY;
      particles.push(makeParticle(x, y));
    }

    // Outline glow particles (silhouette edge)
    // Head outline
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push(makeParticle(
        headCx + Math.cos(angle) * headRx * (0.95 + Math.random() * 0.1),
        headCy + Math.sin(angle) * headRy * (0.95 + Math.random() * 0.1)
      ));
    }

    // Shoulder outline
    for (let i = 0; i < 100; i++) {
      const t = Math.random();
      const y = h * 0.42 + t * h * 0.35;
      const widthAtY = w * 0.12 + t * w * 0.28;
      const side = Math.random() > 0.5 ? 1 : -1;
      particles.push(makeParticle(cx + side * widthAtY * 0.5, y));
    }

    // Hair accents
    for (let i = 0; i < 80; i++) {
      const angle = -Math.PI * 0.8 + Math.random() * Math.PI * 0.6;
      const r = headRx * (1.0 + Math.random() * 0.3);
      particles.push(makeParticle(
        headCx + Math.cos(angle) * r * 1.1,
        headCy + Math.sin(angle) * headRy * (1.0 + Math.random() * 0.25) - headRy * 0.1
      ));
    }

    return particles;
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
      particlesRef.current = createParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.clearRect(0, 0, w, h);

      // Background radial glow
      const grad = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, w * 0.5);
      grad.addColorStop(0, "hsla(195, 100%, 50%, 0.08)");
      grad.addColorStop(0.5, "hsla(195, 100%, 50%, 0.03)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const particles = particlesRef.current;
      const mouseRadius = 80;

      // Update particles
      for (const p of particles) {
        // Mouse repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouseRadius && dist > 0) {
          const force = (mouseRadius - dist) / mouseRadius;
          p.vx += (dx / dist) * force * 3;
          p.vy += (dy / dist) * force * 3;
        }

        // Spring back to origin
        const sx = p.originX - p.x;
        const sy = p.originY - p.y;
        p.vx += sx * 0.03;
        p.vy += sy * 0.03;

        // Damping
        p.vx *= 0.92;
        p.vy *= 0.92;

        // Breathing
        const breath = Math.sin(t * p.speed + p.phase) * 1.5;
        p.x += p.vx + Math.sin(t * 0.5 + p.phase) * 0.3;
        p.y += p.vy + breath * 0.2;

        // Dynamic opacity
        const distFromOrigin = Math.sqrt(sx * sx + sy * sy);
        p.opacity = 0.4 + 0.6 * Math.max(0, 1 - distFromOrigin / 60) * (0.7 + 0.3 * Math.sin(t * p.speed + p.phase));
      }

      // Draw connection lines
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = dx * dx + dy * dy;
          if (d < 900) { // 30px
            const alpha = (1 - d / 900) * 0.15;
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
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(195, 100%, 65%, ${p.opacity})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(195, 100%, 60%, ${p.opacity * 0.15})`;
        ctx.fill();
      }

      // Scan line effect
      const scanY = (t * 40) % h;
      ctx.fillStyle = "hsla(195, 100%, 70%, 0.04)";
      ctx.fillRect(0, scanY, w, 2);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [createParticles]);

  return (
    <div className="relative w-full aspect-square max-w-[480px] mx-auto">
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full animate-pulse"
        style={{
          background: "radial-gradient(circle, hsla(195,100%,50%,0.15) 0%, hsla(195,100%,50%,0.05) 40%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full relative z-10 cursor-crosshair"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}

function makeParticle(x: number, y: number): Particle {
  return {
    x, y,
    originX: x,
    originY: y,
    vx: 0, vy: 0,
    size: 1 + Math.random() * 1.5,
    opacity: 0.5 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 1.5,
  };
}
