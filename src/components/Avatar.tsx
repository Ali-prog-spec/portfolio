import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const SKIN = "#b88562";
const HAIR = "#120d0b";
const SHIRT = "#15171b";

/** Stylised bust of the site owner: swept dark hair, mustache + stubble, teal collared shirt. */
function Bust() {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const blink = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    const { x, y } = state.pointer;
    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, x * 0.6, 4, dt);
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, -y * 0.3, 4, dt);
    }
    if (root.current) {
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, x * 0.15, 3, dt);
    }
    if (blink.current) {
      const t = state.clock.elapsedTime % 4;
      blink.current.scale.y = t > 3.85 ? 0.1 : 1;
    }
  });

  const skin = <meshStandardMaterial color={SKIN} roughness={0.7} />;
  const hair = <meshStandardMaterial color={HAIR} roughness={0.9} />;

  return (
    <group ref={root} position={[0, -0.9, 0]}>
      {/* torso & shoulders */}
      <mesh position={[0, -0.35, 0]} scale={[1.45, 1, 0.8]}>
        <sphereGeometry args={[0.75, 48, 32]} />
        <meshStandardMaterial color={SHIRT} roughness={0.6} />
      </mesh>
      {/* collar */}
      <mesh position={[-0.2, 0.36, 0.33]} rotation={[0.35, 0, 0.7]}>
        <boxGeometry args={[0.34, 0.05, 0.22]} />
        <meshStandardMaterial color="#0c0d10" roughness={0.6} />
      </mesh>
      <mesh position={[0.2, 0.36, 0.33]} rotation={[0.35, 0, -0.7]}>
        <boxGeometry args={[0.34, 0.05, 0.22]} />
        <meshStandardMaterial color="#0c0d10" roughness={0.6} />
      </mesh>
      {/* buttons */}
      {[0.12, -0.1, -0.32].map((y) => (
        <mesh key={y} position={[0, y, 0.6 - Math.abs(y) * 0.12]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshStandardMaterial color="#9fb4bb" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* neck */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.17, 0.2, 0.4, 24]} />
        {skin}
      </mesh>

      {/* head */}
      <group ref={head} position={[0, 0.95, 0]}>
        {/* skull */}
        <mesh scale={[0.9, 1.1, 0.95]}>
          <sphereGeometry args={[0.5, 48, 40]} />
          {skin}
        </mesh>
        {/* jaw / stubble shadow */}
        <mesh position={[0, -0.28, 0.02]} scale={[0.83, 0.55, 0.93]}>
          <sphereGeometry args={[0.5, 40, 32]} />
          <meshStandardMaterial color="#2a1c16" transparent opacity={0.45} roughness={1} />
        </mesh>
        {/* ears */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.45, -0.02, -0.02]} scale={[0.5, 1, 0.8]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            {skin}
          </mesh>
        ))}

        {/* hair: cap + swept fringe */}
        <mesh position={[0, 0.17, -0.07]} scale={[0.97, 0.8, 1.02]}>
          <sphereGeometry args={[0.52, 40, 32, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          {hair}
        </mesh>
        <mesh position={[0.02, 0.4, 0.2]} rotation={[0.3, 0, -0.2]} scale={[1.4, 0.6, 0.95]}>
          <sphereGeometry args={[0.32, 24, 20]} />
          {hair}
        </mesh>
        <mesh position={[0.24, 0.27, 0.3]} rotation={[0.2, 0, -0.6]} scale={[1.1, 0.5, 0.7]}>
          <sphereGeometry args={[0.24, 24, 20]} />
          {hair}
        </mesh>
        <mesh position={[0.34, 0.1, 0.05]} scale={[0.35, 0.9, 0.9]}>
          <sphereGeometry args={[0.2, 20, 20]} />
          {hair}
        </mesh>
        <mesh position={[-0.34, 0.1, 0.05]} scale={[0.35, 0.9, 0.9]}>
          <sphereGeometry args={[0.2, 20, 20]} />
          {hair}
        </mesh>

        {/* brows */}
        <mesh position={[-0.17, 0.12, 0.43]} rotation={[0, -0.25, 0.12]}>
          <boxGeometry args={[0.2, 0.04, 0.03]} />
          {hair}
        </mesh>
        <mesh position={[0.17, 0.13, 0.43]} rotation={[0, 0.25, -0.05]}>
          <boxGeometry args={[0.2, 0.04, 0.03]} />
          {hair}
        </mesh>

        {/* eyes */}
        <group ref={blink} position={[0, 0.03, 0]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.17, 0, 0.4]}>
              <mesh scale={[1.2, 0.8, 0.6]}>
                <sphereGeometry args={[0.06, 20, 16]} />
                <meshStandardMaterial color="#e9e4dc" roughness={0.4} />
              </mesh>
              <mesh position={[0, 0, 0.025]}>
                <sphereGeometry args={[0.032, 16, 16]} />
                <meshStandardMaterial color="#1a100c" roughness={0.2} />
              </mesh>
              {/* heavy lid for the relaxed look */}
              <mesh position={[0, 0.03, 0.01]} scale={[1.3, 0.35, 0.7]}>
                <sphereGeometry args={[0.06, 16, 12]} />
                {skin}
              </mesh>
            </group>
          ))}
        </group>

        {/* nose */}
        <mesh position={[0, -0.1, 0.46]} scale={[0.9, 1.3, 0.9]} rotation={[0.2, 0, 0]}>
          <sphereGeometry args={[0.065, 20, 16]} />
          {skin}
        </mesh>
        {/* mustache */}
        <mesh position={[-0.07, -0.21, 0.44]} rotation={[0, -0.2, Math.PI / 2 - 0.2]}>
          <capsuleGeometry args={[0.022, 0.12, 6, 12]} />
          {hair}
        </mesh>
        <mesh position={[0.07, -0.21, 0.44]} rotation={[0, 0.2, Math.PI / 2 + 0.2]}>
          <capsuleGeometry args={[0.022, 0.12, 6, 12]} />
          {hair}
        </mesh>
        {/* mouth */}
        <mesh position={[0, -0.28, 0.43]} scale={[1, 0.25, 0.5]}>
          <boxGeometry args={[0.13, 0.05, 0.03]} />
          <meshStandardMaterial color="#5a2f26" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

/** Your own scanned/generated model: drop it at public/avatar.glb. Auto-centred and scaled. */
function GlbBust() {
  const { scene } = useGLTF("/avatar.glb");
  const root = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    const m = scene.clone(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = 2.6 / Math.max(size.x, size.y, size.z);
    m.position.sub(center.multiplyScalar(k));
    m.scale.setScalar(k);
    return m;
  }, [scene]);

  useFrame((state, dt) => {
    if (!root.current) return;
    const { x, y } = state.pointer;
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, x * 0.5, 4, dt);
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, -y * 0.2, 4, dt);
  });
  return <group ref={root}><primitive object={model} /></group>;
}

function useHasGlb() {
  const [has, setHas] = useState(false);
  useEffect(() => {
    // Vite's dev server answers unknown paths with index.html, so check the content type too.
    fetch("/avatar.glb", { method: "HEAD" })
      .then((r) => setHas(r.ok && !(r.headers.get("content-type") ?? "").includes("text/html")))
      .catch(() => setHas(false));
  }, []);
  return has;
}

export default function Avatar() {
  const hasGlb = useHasGlb();
  return (
    <Canvas camera={{ position: [0, 0.2, 4.2], fov: 32 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2.5, 3, 4]} intensity={2.2} color="#fff3e6" />
      <directionalLight position={[-3, 1, -2]} intensity={2.4} color="#2dd4bf" />
      <pointLight position={[0, -1.5, 2]} intensity={6} color="#38bdf8" distance={6} />
      <Float speed={1.4} rotationIntensity={0.1} floatIntensity={0.35}>
        {hasGlb ? (
          <Suspense fallback={null}>
            <GlbBust />
          </Suspense>
        ) : (
          <Bust />
        )}
      </Float>
      <Sparkles count={40} scale={[4, 4, 3]} size={2.2} speed={0.35} color="#5eead4" />
    </Canvas>
  );
}
