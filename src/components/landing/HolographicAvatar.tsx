import { useState } from "react";
import evaAvatar from "@/assets/eva-avatar.png";

export function HolographicAvatar() {
  const [offset, setOffset] = useState({ x: 0, y: 0, rotX: 0, rotY: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setOffset({
      x: x * 24,
      y: y * 16,
      rotX: -y * 4,
      rotY: x * 4,
    });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0, rotX: 0, rotY: 0 });
  };

  return (
    <div
      className="relative w-full max-w-[600px] mx-auto"
      style={{ perspective: "1200px" }}
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
        className="relative"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) rotateX(${offset.rotX}deg) rotateY(${offset.rotY}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          animation: "eva-breathe 5s ease-in-out infinite",
        }}
      >
        {/* EVA image */}
        <img
          src={evaAvatar}
          alt="EVA — Assistente IA"
          className="relative z-10 w-full h-auto"
          style={{
            filter: "drop-shadow(0 0 60px hsla(195,100%,50%,0.25)) drop-shadow(0 0 120px hsla(195,100%,50%,0.1))",
          }}
          draggable={false}
        />

        {/* Eye glow overlay — pulses independently */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: "radial-gradient(ellipse 8% 4% at 44% 32%, hsla(195,100%,60%,0.35) 0%, transparent 100%), radial-gradient(ellipse 8% 4% at 56% 32%, hsla(195,100%,60%,0.35) 0%, transparent 100%)",
            animation: "eva-eye-glow 3s ease-in-out infinite",
          }}
        />

        {/* Subtle scanlines overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: "repeating-linear-gradient(0deg, transparent, transparent 3px, hsla(195,100%,50%,0.015) 3px, hsla(195,100%,50%,0.015) 4px)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      <style>{`
        @keyframes eva-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.03); }
        }
        @keyframes eva-breathe {
          0%, 100% { transform: translate(${offset.x}px, ${offset.y}px) rotateX(${offset.rotX}deg) rotateY(${offset.rotY}deg) translateY(0px); }
          50% { transform: translate(${offset.x}px, ${offset.y}px) rotateX(${offset.rotX}deg) rotateY(${offset.rotY}deg) translateY(-6px); }
        }
        @keyframes eva-eye-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}