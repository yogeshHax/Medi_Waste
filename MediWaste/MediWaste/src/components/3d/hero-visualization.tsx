"use client";

import { Suspense, memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { StationHudState } from "@/lib/sim/store";

const CYAN = "#00F0FF";
const GREEN = "#00FF9D";
const PINK = "#FF2A85";
const AMBER = "#FFB454";

/** Mood derived from real HUD state — never fake online. */
export type HoloMood = "offline" | "calm" | "alert";

function moodFromHud(hud: StationHudState): HoloMood {
  if (!hud.online) return "offline";
  if (
    hud.lastStatus === "REQUIRES_REVIEW" ||
    hud.lastStatus === "NOT_ELIGIBLE_FOR_NEXT_STAGE" ||
    hud.lastStatus === "UNAUTHORISED" ||
    hud.lastStatus === "UNKNOWN_ID"
  )
    return "alert";
  return "calm";
}

/* ------------------------------------------------------- anatomical heart */

const HEART_URL = "/models/heart.glb";
useGLTF.preload(HEART_URL);

/** Tissue colours by anatomical part (model ships as separate named meshes). */
function tissueColour(part: string): string {
  if (part.includes("coronary")) return "#e08a72";
  if (part.includes("aorta")) return "#bb394b";
  if (part.includes("pulmonary") || part.includes("vena")) return "#5c66aa";
  if (part.includes("atrium")) return "#8f2334";
  return "#aa2b3d";
}

/**
 * Loads the licensed anatomical heart model (atria, ventricles, great vessels
 * and coronaries) and gives it a wet-tissue physical material. The GLB is
 * centred and normalised so the hero framing does not depend on its units.
 */
function LoadedHeart() {
  const { scene } = useGLTF(HEART_URL);

  const { model, materials } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const targetHeight = 2.15;
    clone.scale.setScalar(targetHeight / (size.y || 1));

    // Re-centre after scaling so the model rotates around its own middle.
    const scaledBox = new THREE.Box3().setFromObject(clone);
    clone.position.sub(scaledBox.getCenter(new THREE.Vector3()));

    const created: THREE.Material[] = [];
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const part = mesh.name.toLowerCase();
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(tissueColour(part)),
        roughness: part.includes("coronary") ? 0.5 : 0.44,
        metalness: 0.02,
        clearcoat: part.includes("coronary") ? 0.3 : 0.55,
        clearcoatRoughness: 0.38,
        sheen: 0.4,
        sheenColor: new THREE.Color("#ff9aa8"),
        sheenRoughness: 0.6,
        emissive: new THREE.Color("#3b0710"),
        emissiveIntensity: 0.14,
      });
      created.push(material);
      mesh.material = material;
      mesh.frustumCulled = true;
    });

    return { model: clone, materials: created };
  }, [scene]);

  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);

  return <primitive object={model} />;
}


const HeartGroup = memo(function HeartGroup({
  mood,
  reduced,
}: {
  mood: HoloMood;
  reduced: boolean;
}) {
  const arrows = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const lastMood = useRef<HoloMood | null>(null);

  const arrowMaterials = useMemo(
    () => [
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9 }),
      new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.9 }),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9 }),
    ],
    []
  );

  useEffect(() => () => arrowMaterials.forEach((m) => m.dispose()), [arrowMaterials]);

  // Arrows carry the station mood; the anatomy keeps its tissue colours.
  useEffect(() => {
    if (lastMood.current === mood) return;
    lastMood.current = mood;
    arrowMaterials.forEach((m, i) => {
      m.color.set(mood === "alert" ? AMBER : i === 1 ? GREEN : CYAN);
      m.opacity = mood === "offline" ? 0.35 : 0.9;
    });
  }, [mood, arrowMaterials]);

  useFrame(({ clock }, delta) => {
    if (reduced) return;
    const t = clock.getElapsedTime();

    const spin = mood === "offline" ? 0.04 : 0.3;
    if (arrows.current) arrows.current.rotation.y += Math.min(delta, 0.1) * spin;

    // Double-beat: a strong ventricular contraction followed by a smaller one.
    const phase = t * 2.15;
    const beat =
      Math.pow(Math.max(0, Math.sin(phase)), 10) +
      0.55 * Math.pow(Math.max(0, Math.sin(phase - 0.32)), 10);
    if (pulseRef.current) {
      const amplitude = mood === "offline" ? 0.004 : mood === "alert" ? 0.024 : 0.016;
      pulseRef.current.scale.setScalar(1 + amplitude * beat);
    }

    if (glowRef.current) {
      const base = mood === "offline" ? 0.35 : mood === "alert" ? 2.4 : 1.5;
      glowRef.current.intensity = base + beat * (mood === "offline" ? 0.1 : 0.9);
    }
    if (pulseRef.current) {
      pulseRef.current.position.y = Math.sin(t * 0.7) * 0.015;
    }
  });

  return (
    <group>
      {/* Licensed anatomical model: both atria, ventricles, aorta, pulmonary
          trunk, vena cava and coronary arteries. Rotated apex-down-left. */}
      <group rotation={[0.05, -0.18, -0.16]} scale={[1, 1, 1]}>
        <group ref={pulseRef}>
          <Suspense fallback={null}>
            <LoadedHeart />
          </Suspense>
          <pointLight
            ref={glowRef}
            position={[0, 0.1, 1.7]}
            color="#ff4d6d"
            intensity={1.5}
            distance={6}
            decay={2}
          />
        </group>
      </group>

      {/* Three orbiting recycling arrows on a tilted axis */}
      <group ref={arrows} rotation={[0.45, 0, 0.1]}>
        {[0, 1, 2].map((i) => {
          const arc = (Math.PI * 2) / 3;
          return (
            <group key={i} rotation={[0, 0, i * arc + 0.25]}>
              <mesh material={arrowMaterials[i]}>
                <torusGeometry args={[1.35, 0.045, 6, 24, arc - 0.25]} />
              </mesh>
              <mesh
                position={[1.35, 0.02, 0]}
                rotation={[Math.PI / 2, 0, -Math.PI / 2]}
                material={arrowMaterials[i]}
              >
                <coneGeometry args={[0.11, 0.28, 10]} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
});

/* ---------------------------------------------------------------- station */

const BOX_POSITIONS: [number, number, number][] = [
  [-0.45, 0.22, 0.32],
  [0.02, 0.22, 0.32],
  [0.5, 0.22, 0.32],
];

function MedicineBox({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.22, 0.1, 0.16]} />
        <meshStandardMaterial color="#12222e" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.052, 0]}>
        <boxGeometry args={[0.2, 0.004, 0.14]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function StationModel({
  irActive,
  gateOpen,
  reduced,
}: {
  irActive: boolean;
  gateOpen: boolean | null;
  reduced: boolean;
}) {
  const laser = useRef<THREE.Mesh>(null);
  const gate = useRef<THREE.Group>(null);
  const sweep = useRef(0);

  useFrame((_, delta) => {
    if (laser.current) {
      laser.current.visible = irActive;
      if (irActive && !reduced) {
        // Simple bounded sawtooth sweep; no per-frame material churn.
        sweep.current = (sweep.current + delta * 0.55) % 1;
        laser.current.position.y = 0.02 + sweep.current * 0.34;
      }
    }
    if (gate.current) {
      const target = gateOpen ? 0.5 : 0;
      const diff = target - gate.current.rotation.x;
      if (Math.abs(diff) < 0.002) {
        gate.current.rotation.x = target;
      } else {
        gate.current.rotation.x += diff * (reduced ? 1 : Math.min(1, delta * 6));
      }
    }
  });

  return (
    <group position={[0, -1.15, 0]} rotation={[0.42, 0.6, 0]}>
      {/* Illuminated circuit baseplate */}
      <mesh>
        <boxGeometry args={[2.6, 0.08, 2.6]} />
        <meshStandardMaterial color="#0b1622" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.042, 0]}>
        <planeGeometry args={[2.5, 2.5]} />
        <meshBasicMaterial color="#0e3a4a" transparent opacity={0.55} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh
          key={i}
          position={[-1.1 + i * 0.44, 0.045, 1.05 - (i % 2) * 0.3]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.02, 0.9]} />
          <meshBasicMaterial color={i % 2 ? GREEN : CYAN} transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Enclosure frame */}
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[1.9, 0.62, 1.2]} />
        <meshStandardMaterial color="#141f2b" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Transparent acrylic inspection chamber */}
      <mesh position={[0, 0.34, 0.32]}>
        <boxGeometry args={[1.7, 0.5, 0.5]} />
        <meshStandardMaterial
          color="#9BE8FF"
          transparent
          opacity={0.12}
          metalness={0.2}
          roughness={0.05}
        />
      </mesh>

      {BOX_POSITIONS.map((position) => (
        <MedicineBox key={position[0]} position={position} />
      ))}

      {/* Laser scan plane — visible only while IR reports a package. */}
      <mesh ref={laser} position={[0, 0.02, 0.32]} visible={irActive}>
        <planeGeometry args={[1.66, 0.03]} />
        <meshBasicMaterial color={PINK} transparent opacity={0.85} />
      </mesh>

      {/* Status LEDs on the front bezel (D12 green / D13 red style) */}
      <mesh position={[0.72, 0.1, 0.62]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color={GREEN} />
      </mesh>
      <mesh position={[0.84, 0.1, 0.62]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>

      {/* Articulated side hatch = servo gate */}
      <group ref={gate} position={[0.95, 0.1, 0.6]}>
        <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.34, 0.62, 0.04]} />
          <meshStandardMaterial color="#1c2b3c" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[1.02, 0.1, 0.15]}>
        <boxGeometry args={[0.14, 0.12, 0.14]} />
        <meshStandardMaterial color="#243b52" metalness={0.6} roughness={0.4} />
      </mesh>

      <pointLight position={[0, 0.2, 0.9]} intensity={0.35} color={CYAN} />
    </group>
  );
}

/* ------------------------------------------------------------------- scene */

export interface HeroSceneProps {
  hud: StationHudState;
  gateOpen: boolean | null; // null = no confirmed command state; never fabricate
  reduced: boolean;
}

/** In demand mode, re-render when meaningful scene inputs change. */
function InvalidateOnChange({ watch }: { watch: unknown[] }) {
  const invalidate = useThree((state) => state.invalidate);
  const key = JSON.stringify(watch);
  useEffect(() => {
    invalidate();
  }, [key, invalidate]);
  return null;
}

function FrameDriver({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const loop = (time: number) => {
      // Cap the hologram at 30 FPS. It reads smoothly and leaves headroom for
      // the rest of the UI instead of competing at 60+ FPS.
      if (time - last >= 1000 / 30) {
        last = time;
        invalidate();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, invalidate]);
  return null;
}

export default function HeroScene({ hud, gateOpen, reduced }: HeroSceneProps) {
  const mood = moodFromHud(hud);
  const hostRef = useRef<HTMLDivElement>(null);
  const intersecting = useRef(true);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const sync = () => setActive(intersecting.current && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting.current = entry.isIntersecting;
        sync();
      },
      { rootMargin: "180px" }
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const sparkProps = useMemo(
    () => ({
      count: mood === "offline" ? 8 : 18,
      scale: [2.2, 3.5, 2.2] as [number, number, number],
      size: mood === "offline" ? 0.7 : 1.4,
      speed: reduced ? 0 : mood === "alert" ? 0.8 : 0.4,
      color: mood === "alert" ? AMBER : CYAN,
      opacity: mood === "offline" ? 0.2 : 0.55,
    }),
    [mood, reduced]
  );

  return (
    <div ref={hostRef} className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0.3, 7.6], fov: 38, near: 0.1, far: 30 }}
        dpr={[1, 1.35]}
        frameloop={active ? "demand" : "never"}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
        style={{ pointerEvents: "none" }}
      >
        <InvalidateOnChange watch={[mood, hud.irActive, gateOpen, reduced, active]} />
        <FrameDriver active={active && !reduced} />
        <ambientLight intensity={0.4} />
        {/* Warm key models the heart tissue; cyan rims match the hologram. */}
        <directionalLight position={[-3.2, 3.4, 4]} intensity={1.5} color="#ffd9df" />
        <directionalLight position={[3, 4, 3]} intensity={0.85} color="#7dd3fc" />
        <directionalLight position={[2.4, -1.2, 3.2]} intensity={0.55} color="#ffb9c4" />
        <pointLight position={[1.8, 2.2, -2.5]} intensity={2.4} color={CYAN} distance={12} />

        <group position={[0, 1.08, 0]}>
          <HeartGroup mood={mood} reduced={reduced} />
          <Sparkles {...sparkProps} />
        </group>

        <StationModel irActive={hud.irActive} gateOpen={gateOpen} reduced={reduced} />

        <Sparkles
          count={6}
          scale={[5, 1.2, 4]}
          position={[0, -1, 0]}
          size={2}
          speed={reduced ? 0 : 0.25}
          color={GREEN}
          opacity={0.35}
        />
      </Canvas>
    </div>
  );
}
