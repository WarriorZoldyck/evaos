import { useState } from "react";
import evaAvatar from "@/assets/eva-avatar.png";

export function HolographicAvatar() {
  const [offset, setOffset] = useState({ x: 0, y: 0, rotX: 0, rotY: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setOffset({
      x: x * 30,
      y: y * 20,
      rotX: -y * 3,
      rotY: x * 3,
    });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0, rotX: 0, rotY: 0 });
  };

  return (
    <div
      className="relative w-full max-w-[680px] mx-auto"
      style={{ perspective: "900px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient glow behind avatar */}
      <div
        className="absolute inset-[-20%] pointer-events-none"
        style={{
          background: "radial-gradient(circle, hsla(195,100%,50%,0.12) 0%, hsla(260,70%,50%,0.04) 40%, transparent 70%)",
          animation: "eva-pulse 4s ease-in-out infinite",
        }}
      />

      {/* Parallax + subtle rotation container */}
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) rotateX(${offset.rotX}deg) rotateY(${offset.rotY}deg) scale(1.15)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* EVA image */}
        <img
          src={evaAvatar}
          alt="EVA — Assistente IA"
          className="relative z-10 w-full h-auto drop-shadow-[0_0_40px_hsla(195,100%,50%,0.3)]"
          style={{ filter: "drop-shadow(0 0 60px hsla(195,100%,50%,0.2))" }}
          draggable={false}
        />

        {/* Subtle scanlines overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: "repeating-linear-gradient(0deg, transparent, transparent 3px, hsla(195,100%,50%,0.02) 3px, hsla(195,100%,50%,0.02) 4px)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      {/* Label */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-[hsl(195,100%,50%/0.6)] font-medium">
          EVA · Assistente IA
        </p>
      </div>

      <style>{`
        @keyframes eva-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.03); }
        }
      `}</style>
    </div>
  );
}
