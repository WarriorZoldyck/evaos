import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import evaAvatar from "@/assets/eva-avatar.png";

/* ─── Custom holographic shader ─── */
const hologramVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const hologramFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uFresnelPower;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // Base texture
    vec4 texColor = texture2D(uTexture, vUv);

    // Fresnel rim glow
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), uFresnelPower);

    // Scanlines
    float scanline = sin(vUv.y * 300.0 + uTime * 2.0) * 0.5 + 0.5;
    scanline = smoothstep(0.3, 0.7, scanline) * 0.15 + 0.85;

    // Horizontal glitch bands
    float glitchBand = step(0.98, sin(uTime * 3.0 + vUv.y * 20.0));
    float glitchOffset = glitchBand * (random(vec2(floor(uTime * 10.0), floor(vUv.y * 20.0))) - 0.5) * 0.03;
    vec4 glitchColor = texture2D(uTexture, vec2(vUv.x + glitchOffset, vUv.y));
    texColor = mix(texColor, glitchColor, glitchBand * 0.6);

    // Digital noise flicker
    float noise = random(vUv + fract(uTime * 0.1)) * 0.06;

    // Holographic tint — cyan/blue with subtle violet
    vec3 holoTint = vec3(0.3, 0.75, 1.0);
    vec3 rimColor = vec3(0.4, 0.55, 1.0);

    // Combine
    vec3 baseColor = texColor.rgb * holoTint * 1.2;
    baseColor *= scanline;
    baseColor += fresnel * rimColor * 0.8;
    baseColor += noise;

    // Transparency: translucent core, brighter at edges
    float alpha = texColor.a * (0.7 + fresnel * 0.3);
    alpha *= (0.88 + sin(uTime * 1.5) * 0.04); // subtle pulse

    gl_FragColor = vec4(baseColor, alpha);
  }
`;

/* ─── Holographic sphere mesh ─── */
function HoloSphere({ mousePos }: { mousePos: React.MutableRefObject<{ x: number; y: number }> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useTexture(evaAvatar);
  const { viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uFresnelPower: { value: 2.5 },
    }),
    [texture]
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;

    // Smooth rotation following mouse
    const targetRotY = (mousePos.current.x - 0.5) * 0.6;
    const targetRotX = (0.5 - mousePos.current.y) * 0.4;

    meshRef.current.rotation.y += (targetRotY - meshRef.current.rotation.y) * 0.05;
    meshRef.current.rotation.x += (targetRotX - meshRef.current.rotation.x) * 0.05;

    // Gentle idle float
    meshRef.current.position.y = Math.sin(t * 0.8) * 0.08;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.6, 64, 64]} />
      <shaderMaterial
        vertexShader={hologramVertexShader}
        fragmentShader={hologramFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ─── Floating ring ─── */
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

/* ─── Floating data particles ─── */
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

/* ─── Main component ─── */
export function HolographicAvatar() {
  const mousePos = useRef({ x: 0.5, y: 0.5 });
  const [isReady, setIsReady] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mousePos.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  return (
    <div
      className="relative w-full aspect-square max-w-[480px] mx-auto"
      onMouseMove={handleMouseMove}
    >
      {/* Background glow */}
      <div
        className="absolute inset-[-15%] rounded-full opacity-40 pointer-events-none"
        style={{
          background: "radial-gradient(circle, hsla(195,100%,50%,0.12) 0%, transparent 70%)",
        }}
      />

      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={() => setIsReady(true)}
        style={{ opacity: isReady ? 1 : 0, transition: "opacity 0.6s ease-in" }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[3, 2, 4]} intensity={0.6} color="#00bfff" />
        <pointLight position={[-3, -1, 3]} intensity={0.3} color="#7b68ee" />

        <HoloSphere mousePos={mousePos} />
        <HoloRing radius={2.0} speed={0.8} opacity={0.2} />
        <HoloRing radius={2.3} speed={-0.5} opacity={0.12} />
        <DataParticles />
      </Canvas>

      {/* Label */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-[hsl(195,100%,50%/0.6)] font-medium">
          EVA · Assistente IA
        </p>
      </div>
    </div>
  );
}
