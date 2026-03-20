import { useState, useCallback } from "react";
import evaAvatar from "@/assets/eva-avatar.png";

export function HolographicAvatar() {
  const [offset, setOffset] = useState({ x: 0, y: 0, rotX: 0, rotY: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setOffset({ x: nx * 20, y: ny * 12, rotX: -ny * 6, rotY: nx * 6 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0, rotX: 0, rotY: 0 });
  }, []);

  return (
    <div
      className="relative w-full mx-auto"
      style={{ perspective: "800px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-[-20%] pointer-events-none"
        style={{
          background: "radial-gradient(circle, hsla(195,100%,50%,0.14) 0%, hsla(260,70%,50%,0.05) 40%, transparent 70%)",
          animation: "eva-pulse 4s ease-in-out infinite",
        }}
      />

      {/* Breathing wrapper */}
      <div className="eva-breathe">
        {/* 3D tilt container */}
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) rotateX(${offset.rotX}deg) rotateY(${offset.rotY}deg)`,
            transformStyle: "preserve-3d",
            transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* EVA image */}
          <img
            src={evaAvatar}
            alt="EVA — Assistente IA"
            className="relative z-10 w-full h-auto"
            style={{
              filter: "drop-shadow(0 0 60px hsla(195,100%,50%,0.3)) drop-shadow(0 0 120px hsla(195,100%,50%,0.12))",
            }}
            draggable={false}
          />

          {/* Scanlines */}
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              background: "repeating-linear-gradient(0deg, transparent, transparent 3px, hsla(195,100%,50%,0.012) 3px, hsla(195,100%,50%,0.012) 4px)",
              mixBlendMode: "screen",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes eva-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.03); }
        }
        .eva-breathe {
          animation: eva-breathe 5s ease-in-out infinite;
        }
        @keyframes eva-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}