import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import evaAvatar from "@/assets/eva-avatar.png";

/* ─── Billboard: EVA image on a flat plane facing camera ─── */
function EvaBillboard() {
  const texture = useTexture(evaAvatar);
  const meshRef = useRef<THREE.Mesh>(null);

  // Keep aspect ratio of the image
  const aspect = useMemo(() => {
    const img = texture.image as HTMLImageElement | undefined;
    if (img) {
      return img.width / img.height;
    }
    return 1;
  }, [texture]);

  const height = 3.2;
  const width = height * aspect;

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.05}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ─── Wireframe holographic sphere ─── */
function HoloWireframeSphere() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.15;
    ref.current.rotation.x = Math.sin(t * 0.1) * 0.1;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2.0, 32, 32]} />
      <meshBasicMaterial
        color="#00bfff"
        wireframe
        transparent
        opacity={0.12}
      />
    </mesh>
  );
}

/* ─── Floating orbital ring ─── */
function HoloRing({ radius, speed, opacity }: { radius: number; speed: number; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.x = Math.PI / 2 + Math.sin(t * speed * 0.3) * 0.15;
    ref.current.rotation.z = t * speed * 0.2;
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.008, 16, 100]} />
      <meshBasicMaterial color="#00bfff" transparent opacity={opacity} />
    </mesh>
  );
}

/* ─── Data particles orbiting ─── */
function DataParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 200;

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.8 + Math.random() * 1.2;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      spd[i] = 0.3 + Math.random() * 0.7;
    }
    return { positions: pos, speeds: spd };
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const speed = speeds[i];
      posAttr.setY(i, posAttr.getY(i) + Math.sin(t * speed + i) * 0.001);
    }
    posAttr.needsUpdate = true;
    pointsRef.current.rotation.y = t * 0.05;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#00d4ff" size={0.02} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

/* ─── Camera parallax following mouse ─── */
function CameraParallax({ mousePos }: { mousePos: React.MutableRefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();
  const basePos = useMemo(() => new THREE.Vector3(0, 0, 4.5), []);

  useFrame(() => {
    const targetX = basePos.x + (mousePos.current.x - 0.5) * 0.6;
    const targetY = basePos.y + (0.5 - mousePos.current.y) * 0.4;

    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ─── Main component ─── */
export function HolographicAvatar() {
  const mousePos = useRef({ x: 0.5, y: 0.5 });
  const [isReady, setIsReady] = useState(false);
  const [tiltStyle, setTiltStyle] = useState({ rotateX: 0, rotateY: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mousePos.current = { x, y };
    setTiltStyle({
      rotateX: (0.5 - y) * 12,
      rotateY: (x - 0.5) * 12,
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({ rotateX: 0, rotateY: 0 });
  };

  return (
    <div
      className="relative w-full aspect-square max-w-[480px] mx-auto"
      style={{ perspective: "800px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background glow */}
      <div
        className="absolute inset-[-15%] rounded-full opacity-40 pointer-events-none"
        style={{
          background: "radial-gradient(circle, hsla(195,100%,50%,0.15) 0%, hsla(260,80%,50%,0.05) 40%, transparent 70%)",
        }}
      />

      {/* 3D tilt container */}
      <div
        className="w-full h-full"
        style={{
          transform: `rotateX(${tiltStyle.rotateX}deg) rotateY(${tiltStyle.rotateY}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.15s ease-out",
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 45 }}
          gl={{ alpha: true, antialias: true }}
          onCreated={() => setIsReady(true)}
          style={{ opacity: isReady ? 1 : 0, transition: "opacity 0.6s ease-in" }}
        >
          <ambientLight intensity={0.4} />
          <pointLight position={[3, 2, 4]} intensity={0.5} color="#00bfff" />
          <pointLight position={[-3, -1, 3]} intensity={0.3} color="#7b68ee" />

          <CameraParallax mousePos={mousePos} />
          <HoloWireframeSphere />
          <EvaBillboard />
          <HoloRing radius={2.2} speed={0.8} opacity={0.18} />
          <HoloRing radius={2.5} speed={-0.5} opacity={0.1} />
          <DataParticles />
        </Canvas>

        {/* Scanlines overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-full"
          style={{
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsla(195,100%,50%,0.03) 2px, hsla(195,100%,50%,0.03) 3px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Pulsing glow overlay */}
        <div
          className="absolute inset-[10%] rounded-full pointer-events-none z-10"
          style={{
            background: "radial-gradient(circle, hsla(195,100%,50%,0.06) 0%, transparent 60%)",
            animation: "pulse-glow 3s ease-in-out infinite",
          }}
        />
      </div>

      {/* Label */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-[hsl(195,100%,50%/0.6)] font-medium">
          EVA · Assistente IA
        </p>
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
